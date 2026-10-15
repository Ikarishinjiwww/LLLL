/* rx-views.js ― 新课契约（rx-content/1）的加载与视图族。旧两课不经过本文件。
 * 依赖既有原语：el()・setView()/registerFrame()・t()/L()・lsGet/lsSet/nk（写入受单写者守卫）。 */
'use strict';

function isRxCourse(){ return !!(App.course && App.course.contract===RX.CONTRACT); }

/* 与旧课 loadCourse 同一顺序：先取齐并校验，全部通过才切换；失败时原课原画面不动。 */
async function loadRxCourse(meta){
  const seq=++loadSeq;
  const hadCourse=!!(App.course&&App.idx);
  let cv,tv;
  try{
    cv=await fetchJSONv(meta.dir+'/course.json');
    tv=await fetchJSONv(meta.dir+'/content.json');
  }catch(e){
    if(seq!==loadSeq) return false;
    if(hadCourse){ toast(navigator.onLine===false?t('swCourseOff'):t('loadErr')); return false; }
    renderLoadError(meta.dir+'/content.json',e); return false;
  }
  if(seq!==loadSeq) return false;
  const v=RX.validate(cv.data,tv.data,meta.id);
  if(v.fatal.length){
    if(hadCourse){ toast(t('loadErr')); return false; }
    renderLoadError(meta.dir+'/content.json',new Error(v.fatal.join(' / '))); return false;
  }
  examDropClean(); // 前の課の定稿済み模試の残り記録は、ロックを返す前に消し直す（X17b-01）
  releaseWriter();
  App.course=meta; lsSet('quiz:lastCourse',meta.id);
  try{ if(App.rxRun && App.rxRun.cid!==meta.id){ rxClearTimer(); App.rxRun=null; } }catch(e){} // 切課が成った：前の課の練習（限時の再試行を含む）を打ち切る（CR-23）。失敗なら残す（CR-33）
  applySkin(meta);
  viewStack=[]; App.session=null; App.reader=null; App.readerReturn=null;
  resetBuddy();
  refreshChrome();
  /* 旧课的全局结构给出合法的空值：仍可能被共用部件（设置・键盘・切课统计）读到，不能为 undefined */
  App.questions=[]; App.concepts={}; App.manual=null; App.validation={errors:[],warnings:[],fatal:false};
  App.idx=C.buildIndices([],{}); App.errView=null;
  const ix=RX.buildIndex(tv.data);
  App.rx={ course:cv.data, content:tv.data, ix:ix, diag:v.diag.concat(ix.diag) };
  loadProgress();
  renderHome();
  requestWriter(false); // 旧課と同じ：書き手の待ち行列へ（空いていればすぐ書き手になり、becomeWriter が読み直す）
  showImportSkipped(); // 旧課と同じ：取り込み直後の再読み込みで一度だけ結果を知らせる（新課では呼ばれていなかった）
  rxVaultInit(); // 真题层：取封套、本机有钥匙则免口令解开（不阻塞首页）
  rxPrefetchOthers(); // 跨课链接用：背景取其他新课的公开内容
  return true;
}

/* ---------- ホーム（回の一覧） ---------- */
function renderRxHome(){
  registerFrame(renderHome,'home');
  clearCareTimer(); clearRunnerTimer();
  const ix=App.rx.ix;
  const left=daysUntilExam(); // 章程第 24 条：臨床の homeHeroNode と同じく、問候が主見出し・その下に試験日の一行（課名は topbar の chip にある）。新課には問題数がないので「1日 N 問」の目安は出さない
  const sub=(left!=null&&left>0)?t('examIn').replace('{n}','<b>'+left+'</b>'):(left!=null&&left<=0)?t('examDay'):t('setExam')+' ›';
  const kids=[ el('div',{class:'rx-hd'},[ el('div',{class:'greet1b jp'},kaoWrap(greetMsg())), el('button',{class:'greetsub jp',html:sub,onclick:openExamDate}) ]) ];
  kids[0].appendChild(rxSearchBarNode()); // 検索の入口：問候・試験日の下（Q-026）
  const list=el('div',{class:'rx-lecs'});
  ix.lectures.forEach(function(Lc){
    list.appendChild(el('button',{class:'rx-lec jp','data-lec':Lc.id,onclick:function(){ renderRxLecture(Lc.id,null,{fast:true}); }},[
      el('span',{class:'rx-lec-n',text:t('rxKaiN').replace('{n}',Lc.kai)}),
      el('span',{class:'rx-lec-t',text:Lc.title||''}),
      el('span',{class:'rx-lec-go','aria-hidden':'true',text:'›'}), // 押せる行だと分かるように（U-52）
      el('span',{class:'rx-lec-m jp',text:rxMasteryLine(Lc)}),
      rxMasteryBar(Lc) // 覚えた・学習中・未着手の割合の細い棒（U-41 样张では宽屏だけ → U-52 で全宽度に）
    ]));
  });
  const rd=lsGet(nk('rx:read'),null), rl=rd&&ix.lecById[rd.lec];
  if(rl){ const rc=rd.card&&ix.cards[rd.card]&&ix.cards[rd.card].card;
    kids.push(el('button',{class:'nh-cont rx-cont',onclick:function(){ rxResume(rd); }},[ el('span',{class:'nc-l jp',text:t('flagManualCont')}),
      el('span',{class:'nc-t jp',text:t('rxKaiN').replace('{n}',rl.kai)+'　'+(rc?(rc.title||''):(rl.title||''))}), el('span',{class:'nc-a',text:'›'}) ])); }
  kids.push(list);
  const rr=rxRulesLink('rx-rules-row'); if(rr) kids.push(rr); // 答法规则（課ページに一度）：回一覧の下
  // 宽屏（≥1200）は二栏：左＝続きから・回一覧、右＝今日の復習などの付加部（U-41 样张）。窄屏は従来の順（問候→付加部→続きから→回一覧）
  const hd=kids.shift(), side=el('div',{class:'rx-home-side'},rxHomeExtras()), mainCol=el('div',{class:'rx-home-main'},kids);
  const all=[ hd, side, mainCol ];
  const a2i=a2hsImportCardNode(); if(a2i) all.unshift(a2i); // U-03: ホーム画面アプリの初回は、取り込みの案内を一番上に
  setView(el('div',{class:'rx-home rx-home-grid'},all)); document.body.classList.add('rx-wide');
}

/* ---------- 回视图：一枚要点 → カード群 → 深読み → 講義と標準のずれ ---------- */
function rxStars(imp){ const n=Math.max(0,Math.min(3,imp|0)); return n?'★'.repeat(n):''; }

/* ===== 呈現修復（ux/render 第一步：S6 方案 f29e174 ほか）：回のページの「読む」「覚える」 =====
 * 覚える：各命題はページに一度だけ全文（本拠：方案 2-1 の順）。ほかの所は短い参照（★・冒頭・↗）で本拠へ跳び、「元の位置に戻る」で戻れる。
 *   三栏は畳む：本拠の行の下に「試験では：…」を二行まで（全文は DOM に残す）＋比較を開くボタン。triple.tag が memo の命題は二行を出さずボタンだけ（方案 4-4）。
 * 読む：讲解块（第二步：ix.explain）・図・表・症例を前に、命題は「根拠を見る（n）」に畳む。讲解块の無いカードは ★★★ の命題だけ全文（降級：方案 4-2）。
 * 表示の選択は課ごとに quiz:<課>:rx:view（偏好：書けない只読のタブではこの起動の間だけ。只読の説明は出さない）。覚えていなければ讲解块のある回は「読む」、無い回は「覚える」。 */
let RXR=null; // 描画中だけ：{view, home:{命題:カード id|'gaps'}, done:{}}
function rxViewPref(){ const cid=App.course&&App.course.id, m=App.rxViewMem||{}; if(cid && m[cid]) return m[cid]; const v=lsGet(nk('rx:view'),null); return (v==='read'||v==='mem')?v:null; }
function rxHasExplain(Lc){ const ex=App.rx.ix.explain; return !!ex && (Lc.cards||[]).some(function(c){ return ex[c.id] && ex[c.id].length; }); }
function rxViewOf(Lc){ const tv=App.rxViewTmp; if(tv && tv.lec===Lc.id) return tv.view; return rxViewPref()||(rxHasExplain(Lc)?'read':'mem'); } // rxViewTmp：落点のための臨時の表示（偏好には書かない。別の回を開くか、利用者が切り替えると消える）
function rxSetView(v){ App.rxViewTmp=null; (App.rxViewMem||(App.rxViewMem={}))[App.course.id]=v; lsSet(nk('rx:view'),v); } // 書き手でなければ lsSet は書かない（偏好なので只読の説明も帯も出さない）
function rxHomeMap(Lc){ // 本拠（方案 2-1）：非「発展」の欄 → 「発展」の欄と段落 → カード下の一覧（表の行・カード級・非「発展」の段落）→ 図の答えられること → ずれ
  const ix=App.rx.ix, H={}, set=function(pid,k){ if(pid && ix.props[pid] && !(pid in H)) H[pid]=k; };
  const fp=function(c){ (c.fields||[]).forEach(function(f){ (f.props||[]).forEach(function(pid){ set(pid,c.id); }); }); };
  const bp=function(c){ (c.blocks||[]).forEach(function(b){ (b.props||[]).forEach(function(pid){ set(pid,c.id); }); }); };
  const cs=RX.orderOf(Lc).map(function(id){ return ix.cards[id]&&ix.cards[id].card; }).filter(Boolean);
  cs.forEach(function(c){ if(c.kind!=='deep') fp(c); });
  cs.forEach(function(c){ if(c.kind==='deep'){ fp(c); bp(c); } });
  cs.forEach(function(c){ if(c.rows && c.cols) c.rows.forEach(function(r){ (r.props||[]).forEach(function(pid){ set(pid,c.id); }); }); (c.props||[]).forEach(function(pid){ set(pid,c.id); }); if(c.kind!=='deep') bp(c); });
  cs.forEach(function(c){ (c.answers||[]).forEach(function(pid){ set(pid,c.id); }); });
  (Lc.gaps||[]).forEach(function(pid){ set(pid,'gaps'); });
  return H; }
function rxPL(pid,where,opt){ // 覚える：この場所が本拠で、まだ印していなければ全文。そうでなければ短い参照
  const e=App.rx.ix.props[pid]; if(!e) return null;
  if(RXR && RXR.view==='mem'){ if(RXR.home[pid]===where && !RXR.done[pid]){ RXR.done[pid]=1; return rxPropLine(e.prop,opt); } return rxPropRef(e.prop); }
  return rxPropLine(e.prop,opt); }
let rxRefSeq=0;
function rxPropRef(p){ // 短い参照：★・冒頭約 16 字・↗。data-prop は付けない（検索の選び先にしない：S1 と合意）
  const tx=p.text.length>16?p.text.slice(0,16)+'…':p.text, id='rxref-'+(++rxRefSeq);
  // 読屏名＝動作＋目標の全文（同じ書き出しの参照を区別：快审第二十七批 R-05）。二つの名前節点を aria-labelledby で組む：動作は画面の言語、命題は ja（签发 24e7426）
  return el('button',{class:'rx-pref jp','data-prop-ref':p.id,title:p.text,'aria-labelledby':id+'-a '+id+'-t',onclick:function(){ rxGoHome(p.id); }},[
    el('span',{class:'rx-stars','aria-hidden':'true',text:rxStars(p.imp)}), el('span',{class:'rx-pref-t',text:tx}), el('span',{class:'rx-pref-a','aria-hidden':'true',text:'↗'}),
    el('span',{id:id+'-a',hidden:'',lang:App.lang==='zh'?'zh-Hans':'ja',text:String(t('rxRefGo')).replace('{text}','')}), el('span',{id:id+'-t',hidden:'',lang:'ja',text:p.text}) ]); }
function rxGoHome(pid){ // 短い参照から本拠へ。跳ぶ前の位置へ戻るボタンを出す（履歴には足さない）
  const H=App.rxHome, h=H&&H.map[pid]; if(!h) return;
  const y0=window.scrollY;
  if(h==='gaps') rxGoGaps(pid); else rxGoCard(h,pid,{anchor:'prop'});
  rxBackSpot(y0); }
function rxBackSpot(y0){ // 「元の位置に戻る」：6 秒で消える。利用者が自分でスクロール・キー操作をしたら消える
  const old=document.querySelector('.rx-backspot'); if(old && old.__off) old.__off(true); // 入れ替えは即時（二つ並ばない）
  const evs=['wheel','touchmove','keydown'];
  const b=el('button',{class:'btn sm jp rx-backspot',text:t('rxBackSpot'),onclick:function(){ off(); if(typeof rxAlignOff==='function' && rxAlignOff) rxAlignOff(); window.scrollTo(0,y0); }});
  const tm=setTimeout(function(){ off(); },6000);
  function off(now){ clearTimeout(tm); evs.forEach(function(ev){ window.removeEventListener(ev,off,{capture:true}); }); if(!b.isConnected) return;
    if(now===true){ b.remove(); return; } b.classList.add('out'); setTimeout(function(){ if(b.isConnected) b.remove(); },150); } // 退場は淡出（120ms、CSS）のあと外す；reduce は過渡なしで同じ経路（前端計画 003）
  b.__off=off;
  setTimeout(function(){ evs.forEach(function(ev){ window.addEventListener(ev,off,{passive:true,capture:true}); }); },0); // 跳んだ直後の自前のスクロールでは消さない
  document.body.appendChild(b); }
function rxTriExamLine(p){ return el('div',{class:'rx-tri1 jp','data-tri-for':p.id},[ el('span',{class:'rx-tri1-h',text:t('rxTriExam')+'：'}), el('span',{class:'rx-tri1-x',text:(p.triple&&p.triple.exam)||''}) ]); } // 二行まで（CSS）・全文は DOM に
function rxTriTog(tr){ // 比較を開く・閉じる（その場で三栏）
  const box=el('div',{class:'rx-tri-box'});
  const b=el('button',{class:'rx-tri-tog jp','aria-expanded':'false',text:t('rxTriSee'),onclick:function(){ rxTriSet(b,box,tr,b.getAttribute('aria-expanded')!=='true'); b.focus(); }});
  b.__set=function(on){ rxTriSet(b,box,tr,on); };
  return [b,box]; }
function rxTriSet(b,box,tr,open){ box.textContent=''; if(open) box.appendChild(rxTriple(tr)); b.setAttribute('aria-expanded',String(open)); b.textContent=t(open?'rxTriClose':'rxTriSee'); }
function rxViewSeg(Lc){ // 「読む」｜「覚える」：切り替えても、いま読んでいるカードの頭に戻る
  const v=RXR.view, seg=el('div',{class:'setseg rx-viewseg',role:'group','aria-label':t('rxViewLabel')});
  [['read','rxViewRead'],['mem','rxViewMem']].forEach(function(x){
    seg.appendChild(el('button',{class:'segbtn'+(v===x[0]?' on':''),'data-view':x[0],'aria-pressed':String(v===x[0]),text:t(x[1]),onclick:function(){
      if(rxViewOf(Lc)===x[0]) return; const keep=rxTopCard(); rxSetView(x[0]); renderRxLecture(Lc.id); rxKeepCard(keep); }})); });
  return seg; }
function rxTopCard(){ const tb=document.querySelector('.topbar'), b=tb?tb.getBoundingClientRect().bottom:0;
  const cs=[].slice.call(document.querySelectorAll('#view .rx-lec-main .rx-card')).filter(function(n){ return n.getClientRects().length; });
  for(let i=0;i<cs.length;i++){ const r=cs[i].getBoundingClientRect(); if(r.bottom>b+8) return {id:cs[i].id, off:r.top}; }
  return null; }
function rxKeepCard(k){ if(!k) return; const go=function(){ const n=document.getElementById(k.id); if(!n || !n.getClientRects().length) return; window.scrollBy(0,n.getBoundingClientRect().top-k.off); };
  go(); requestAnimationFrame(go); setTimeout(go,120); }

function renderRxLecture(lecId,focusCard,opts){ // opts.fast：利用者が回を「開く」一回目だけ、首屏の外を布局せずに画く（V-06）。着地・戻る・描き直しは常に全布局
  registerFrame(function(){ renderRxLecture(lecId); },'rx-lec:'+lecId);
  const ix=App.rx.ix, Lc=ix.lecById[lecId];
  if(!Lc){ goHome(); return; }
  const below=viewStack[viewStack.length-2]; // 戻り先の名前を戻るボタンに（演習から根拠へ来た／別の課から来た：U-11・U-10）
  const backLabel=(below&&below.key==='rx-run')?t('rxBackToRun'):((below&&below.xname)?t('rxBackToCourse').replace('{c}',below.xname):null);
  const kids=[ sectionHead('',goBack,backLabel), // 画面名は直下の h1（第N回 回名）。「ホーム」は戻り先で、この画面の名前ではない（U-31）
    el('h1',{class:'rx-h jp',text:t('rxKaiN').replace('{n}',Lc.kai)+'　'+(Lc.title||'')}) ];
  if(Lc.syllabus) kids.push(el('p',{class:'rx-syl jp',text:Lc.syllabus}));
  const rg=rxRulesLink('rx-rules-go'); if(rg) kids.push(rg); // 回の先頭から答法规则へ一行（「読む」「覚える」とも）
  const tools=rxLectureTools(Lc); tools.insertBefore(el('button',{class:'btn ghost sm jp rx-toc-btn',text:t('rdrToc'),onclick:function(){ rxOpenToc(Lc); }}),tools.firstChild); kids.push(tools);
  if(App.rxViewTmp && App.rxViewTmp.lec!==Lc.id) App.rxViewTmp=null;
  RXR={view:rxViewOf(Lc), home:rxHomeMap(Lc), done:{}}; App.rxHome={lec:Lc.id, map:RXR.home, view:RXR.view};
  kids.push(rxViewSeg(Lc));
  const prac=rxPracticeBar(Lc); if(prac){ prac.id='rx-prac'; kids.push(prac); } // 演習の入口は要点より前（要点 10 件で首屏の外へ押し出されていた：U-56）
  const sum=rxSummaryBlock(Lc); if(sum){ sum.id='rx-sum'; kids.push(sum); }
  const order=RX.orderOf(Lc).map(function(id){ return ix.cards[id]&&ix.cards[id].card; }).filter(Boolean);
  const main=order.filter(function(c){ return c.kind!=='deep'; }), deep=order.filter(function(c){ return c.kind==='deep'; });
  if(main.length) kids.push(el('h2',{class:'rx-bh jp',text:t('rxCards')})); // カードの無い回に空の見出しを出さない（break-ui B-3）
  main.forEach(function(c){ kids.push(rxCard(c)); });
  if(deep.length){
    const d=el('details',{class:'rx-deep',id:'rx-deep'},[ el('summary',{class:'rx-bh jp',text:t('rxDeep')}) ]);
    deep.forEach(function(c){ const cd=rxCard(c); if((c.title||'').trim()===t('rxDeep').trim()) cd.classList.add('rx-dup-t'); d.appendChild(cd); }); // 「発展」の直下に同名の見出しが重なるときは見出しを隠す（データは不変：复查 U-83）
    kids.push(d);
  }
  const gaps=RXR.view==='read'?null:rxGapsBlock(Lc); if(gaps){ gaps.id='rx-gaps'; kids.push(gaps); } // ずれは試験の面：「読む」では出さない
  const nx=ix.lectures[ix.lectures.indexOf(Lc)+1]; // 回の終わりから次の回へ（U-39）
  if(nx) kids.push(el('div',{class:'rx-next'},[ el('button',{class:'btn ghost jp',text:t('rxNextLec'),onclick:function(){ renderRxLecture(nx.id,null,{fast:true}); }}),
    el('div',{class:'rx-next-t jp',text:t('rxKaiN').replace('{n}',nx.kai)+'　'+(nx.title||'')}) ]));
  const mainCol=el('div',{class:'rx-lec-main'},kids);
  const fast=!!(opts&&opts.fast)&&!focusCard&&!App.rxLand;
  const page=el('div',{class:'rx-lecture rx-lec-grid rx-v-'+RXR.view+(fast?' rx-cv':''),'data-lec':Lc.id},[ rxSideToc(Lc,mainCol), mainCol, rxRail(Lc) ]); // 宽屏（≥1200 目次｜本文、≥1440 ＋辅助栏）：U-41 样张。窄屏は目次と辅助栏を出さず従来どおり
  RXR=null; // 本拠の印し分けはこの描画のあいだだけ（概念ページ・演習の根拠・結果は全文のまま）
  setView(page); App.rxTocLec=Lc; App.tocOpen=function(){ rxOpenToc(Lc); }; document.body.classList.add('rx-lec-view','rx-wide'); // 目次は顶栏の 44px ボタン（≥1200 は左の常設目次）
  if(fast) requestAnimationFrame(function(){ requestAnimationFrame(function(){ page.classList.remove('rx-cv'); }); }); // 一度画いてから残りを布局（INP は最初の画までで決まる）
  rxMarkLanding(); rxSpy();
  if(focusCard){ const n=document.getElementById('rxc-'+focusCard); if(n){ const dt=n.closest('details'); if(dt) dt.open=true; n.scrollIntoView({block:'start'}); } }
}

/* 一枚要点：问句在前，点开才显示命题（先答后看）。没有 recall 的项不进（降级）。 */
function rxSummaryBlock(Lc){
  const ix=App.rx.ix, items=((Lc.summary&&Lc.summary.items)||[]).map(function(it){ return ix.props[it.prop]&&ix.props[it.prop].prop; })
    .filter(function(p){ return p && p.recall; }); // 件数の上限は内容の闸门（≤15）が守る：ここでは切らない（.slice(0,10) で 11 件目以降が出ていなかった：S5 指摘）
  if(!items.length) return null;
  const box=el('section',{class:'rx-sum'},[ el('h2',{class:'rx-bh jp',text:t('rxSummary')}) ]), FIRST=3; // 最初は 3 件、残りは「残り n 件」で（U-56）
  const rows=items.map(function(p,i){
    const ans=el('div',{class:'rx-sum-a jp hide'},[ rxPropLine(p,{noTriple:true}) ]), hint=el('span',{class:'rx-q-h',text:t('rxShow')});
    const btn=el('button',{class:'rx-sum-q jp','aria-expanded':'false',onclick:function(){
      const open=ans.classList.toggle('hide')===false; btn.setAttribute('aria-expanded',String(open)); hint.textContent=t(open?'rxHideAns':'rxShow'); }},[ // 開いたら「答えを隠す」
      el('span',{class:'rx-q-t',text:p.recall}), hint ]);
    const row=el('div',{class:'rx-sum-i'+(i>=FIRST?' rx-sum-x':'')},[btn,ans]); box.appendChild(row); return row;
  });
  if(rows.length>FIRST){
    const more=el('button',{class:'btn ghost sm jp rx-sum-more',text:tf('rxSumMore',{n:rows.length-FIRST}),onclick:function(){
      rows.forEach(function(r){ r.classList.remove('rx-sum-x'); }); more.remove(); const q=rows[FIRST].querySelector('.rx-sum-q'); if(q) q.focus(); }});
    box.appendChild(more);
  }
  return box;
}

/* 命题一行：★（重点徽标）＋命题文；有 triple 时只在按 order 首次出现的卡片里展开三栏，其余处给一条跳转。 */
function rxPropLine(p,opt){
  opt=opt||{};
  const line=el('div',{class:'rx-prop','data-prop':p.id},[
    el('span',{class:'rx-stars','aria-hidden':'true',text:rxStars(p.imp)}),
    p.imp>=3?el('span',{class:'rx-imp jp',text:t('rxImp')}):null,
    el('span',{class:'rx-pt jp',text:p.text})
  ].filter(Boolean));
  if(!p.triple || opt.noTriple) return line;
  if(RXR){ const tag=String(p.triple.tag||'').toLowerCase(), kids=[line];
    if(RXR.view==='mem' && tag!=='memo') kids.push(rxTriExamLine(p)); // memo（講義の備忘）は二行を出さず比較の入口だけ（方案 4-4）
    return el('div',{class:'rx-prop-w'},kids.concat(rxTriTog(p.triple))); }
  const first=rxTriHome(p.id);
  if(first && opt.cardId===first) return el('div',{class:'rx-prop-w'},[ line, rxTriple(p.triple) ]);
  if(first) return el('div',{class:'rx-prop-w'},[ line,
    el('button',{class:'rx-tri-go jp',onclick:function(){ rxGoCard(first,p.id); },text:t('rxTriSee')}) ]);
  return line;
}

function rxTriple(tr){
  const ix=App.rx.ix;
  const refs=(tr.standard_refs||[]).map(function(r){ return ix.refs[r]&&ix.refs[r].short; }).filter(Boolean);
  return el('div',{class:'rx-tri'},[
    el('div',{class:'rx-tri-c'},[ el('div',{class:'rx-tri-h jp',text:t('rxTriLec')}), el('p',{class:'jp',text:tr.lecture||''}) ]),
    el('div',{class:'rx-tri-c'},[ el('div',{class:'rx-tri-h jp',text:t('rxTriStd')}), el('p',{class:'jp',text:tr.standard||''}),
      refs.length?el('div',{class:'rx-refs jp',text:refs.join('・')}):null ].filter(Boolean)),
    el('div',{class:'rx-tri-c'},[ el('div',{class:'rx-tri-h jp',text:t('rxTriExam')}), el('p',{class:'jp',text:tr.exam||''}) ])
  ]);
}

function rxGoCard(cardId,propId,opts){ // opts.reveal：遮っていれば解く（検索の落点だけ）。opts.anchor==='prop'：その命題の行を顶栏下約 1/3 に。opts.hold：高亮を利用者が動かすまで（最長約 3 秒）。検索の「本文」落点用（复查 C-N01）。他の呼び手は従来どおりカード頭
  opts=opts||{};
  const ce=App.rx.ix.cards[cardId]; if(!ce) return;
  const here=document.getElementById('rxc-'+cardId);
  if(!here){ renderRxLecture(ce.lec,cardId); }
  if(propId){ const c0=document.getElementById('rxc-'+cardId), H=App.rxHome; // 覚える：このカードでは短い参照なら、本拠のカードの本拠の行へ（方案 2-3）
    if(c0 && !c0.querySelector('[data-prop="'+propId+'"]') && H && H.lec===ce.lec){ const h=H.map[propId];
      if(h==='gaps'){ rxGoGaps(propId,opts); return; } if(h && App.rx.ix.cards[h]) cardId=h; } }
  const n=document.getElementById('rxc-'+cardId); if(!n) return;
  const dt=n.closest('details'); if(dt) dt.open=true; // 発展のカードは畳まれている
  if(propId){ const r0=n.querySelector('[data-prop="'+propId+'"]'), bs=r0&&r0.closest('details.rx-basis'); if(bs) bs.open=true; } // 読む：「根拠を見る」に畳まれていれば開いてから
  if(opts.reveal && n.classList.contains('rx-hidden') && n.__rxHide) n.__rxHide(false); // 検索の落点（opts.reveal）だけ目標のカードの遮りを解く（覚えた遮りからも外す）。目次・根拠・三栏の跳び先は遮ったまま（复验 N-B：総指揮裁定）
  const rowSel=(opts.anchor==='prop' && propId)?'[data-prop="'+propId+'"]':null, row=rowSel&&n.querySelector(rowSel);
  if(row) window.scrollBy(0,row.getBoundingClientRect().top-rxRowTarget()); else n.scrollIntoView({block:'start'}); // 行が見つからなければカード頭
  App.rxLand={card:cardId,prop:propId,until:Date.now()+(opts.hold?3000:1600),hold:!!opts.hold};
  rxMarkLanding(); rxAlignLanding(cardId,row?rowSel:null);
}
function rxGoGaps(pid,opts){ opts=opts||{}; // 本拠が「講義と標準のずれ」の命題（ずれにだけ出る）：その行へ。どの画面からでも呼べる（検索の落点も：S1 と合意）
  const e=App.rx.ix.props[pid], Lc=e&&App.rx.ix.lecById[e.lec]; if(!Lc) return;
  const sel='[data-prop="'+pid+'"]', on=function(){ const g=[].slice.call(document.querySelectorAll('#view .rx-lecture[data-lec="'+Lc.id+'"] #rx-gaps')).filter(function(x){ return !x.closest('.nav-leave-fwd,.nav-leave-back'); })[0]; return g&&g.querySelector(sel); }; // 離場層の古い頁は数えない
  if(!on()){ if(rxViewOf(Lc)==='read') App.rxViewTmp={lec:Lc.id,view:'mem'}; // 「読む」にずれは無い：臨時に「覚える」へ（偏好には書かない。総指揮裁定 2026-10-14）
    renderRxLecture(Lc.id); }
  const r=on(); if(!r) return;
  window.scrollBy(0,r.getBoundingClientRect().top-rxRowTarget());
  App.rxLand={card:null,gaps:true,prop:pid,until:Date.now()+(opts.hold?3000:1600),hold:!!opts.hold}; // gaps:true の落点は #rx-gaps 内の [data-prop] の行（S1 の検索語の色付けもこの行）
  rxMarkLanding(); rxAlignLanding(null,sel,'rx-gaps',Lc.id); }
function rxRowTarget(){ const tb=document.querySelector('.topbar'), b=tb?tb.getBoundingClientRect().bottom:52; return b+(window.innerHeight-b)/3; } // 行の落ち着き先：顶栏の下、残りの高さの 1/3
let rxAlignOff=null;
function rxAlignLanding(cardId,rowSel,rootId,lecId){ // rootId・lecId：カード以外の根（ずれ：rx-gaps） // rowSel：命題の行に合わせる（C-N01）。無ければカード頭 // 着地したカードを「要素」で錨止め：図の非同期読み込み・書き手確定後の描き直し・入場の変形で版面が動くあいだ、顶栏の下へ合わせ直す。
  // 利用者がスクロール・タップ・キーを使うまで（最長 10 秒）錨を保つ：その間に版面が伸び縮みしたら合わせ直す（收尾清单 U-10：数字の y で戻すと押し流されていた）
  if(rxAlignOff) rxAlignOff();
  const view=document.getElementById('view'), t0=Date.now(), evs=['wheel','touchstart','keydown','pointerdown']; // popstate では止めない：切課のときアプリ自身の履歴整理（見張りを外す history.back）が後から届き、新しい落点の対齐まで止めていた（U-10b）
  const ce=cardId?App.rx.ix.cards[cardId]:null, lk=ce?ce.lec:lecId, fk=lk?'rx-lec:'+lk:null, rid=rootId||('rxc-'+cardId); // 合わせ直すのは、この回が最前面の画面のあいだだけ
  let done=false;
  const align=function(){ if(done) return; const fr=viewStack[viewStack.length-1]; if(!fr || fr.key!==fk){ finish(); return; } // 別の画面へ移った：止める（離場層のカードを見つけて新しい画面を動かしていた：N-A）
    const n=document.getElementById(rid); if(!n || n.closest('.nav-leave-fwd,.nav-leave-back')) return;
    const r=rowSel&&n.querySelector(rowSel); if(r){ const d=r.getBoundingClientRect().top-rxRowTarget(); if(Math.abs(d)>24) window.scrollBy(0,d); return; }
    const tb=document.querySelector('.topbar'), b=tb?tb.getBoundingClientRect().bottom:52, top=n.getBoundingClientRect().top;
    if(top<b-1 || top>b+48) n.scrollIntoView({block:'start'}); };
  const ro=(typeof ResizeObserver==='function')?new ResizeObserver(function(){ requestAnimationFrame(align); }):null;
  if(ro && view) ro.observe(view);
  const onLoad=function(e){ if(e.target && e.target.tagName==='IMG') requestAnimationFrame(align); };
  document.addEventListener('load',onLoad,true);
  const tick=setInterval(function(){ align(); if(Date.now()-t0>10000) finish(); },400);
  function finish(){ if(done) return; done=true; clearInterval(tick); if(ro) ro.disconnect(); document.removeEventListener('load',onLoad,true); evs.forEach(function(ev){ window.removeEventListener(ev,finish,{capture:true}); }); if(rxAlignOff===finish) rxAlignOff=null; }
  evs.forEach(function(ev){ window.addEventListener(ev,finish,{passive:true,capture:true}); });
  rxAlignOff=finish;
}
function rxMarkLanding(){ // 着いたカード（命題）を一瞬示す。直後の描き直し（書き手の交代など）で DOM が替わっても残りの時間だけ付け直す
  const L=App.rxLand; if(!L || Date.now()>=L.until) return;
  const rid=L.gaps?'rx-gaps':'rxc-'+L.card, n=document.getElementById(rid); if(!n) return;
  const pl=L.prop&&n.querySelector('[data-prop="'+L.prop+'"]'), tgt=pl||n, cls=pl?'rx-hl':'rc-flash';
  tgt.classList.add(cls); setTimeout(function(){ tgt.classList.remove(cls); },Math.max(0,L.until-Date.now()));
  if(L.hold && !L.holdOn){ L.holdOn=true; const evs=['wheel','touchstart','keydown','pointerdown']; // 保持：利用者が動かした時点で消す（最長は until まで）
    const stop=function(){ evs.forEach(function(ev){ window.removeEventListener(ev,stop,{capture:true}); }); if(App.rxLand!==L) return; L.until=Date.now();
      document.querySelectorAll('#'+rid+' .rx-hl, #'+rid+'.rc-flash').forEach(function(x){ x.classList.remove('rx-hl','rc-flash'); }); };
    evs.forEach(function(ev){ window.addEventListener(ev,stop,{passive:true,capture:true}); }); }
}

/* 目次：この回の要点・演習・各カード・発展・ずれ へ跳ぶ（U-39 前半） */
function rxTocRows(Lc,root){
  const ix=App.rx.ix, rows=[];
  const sec=function(id,label){ if(root.querySelector('#'+id)) rows.push({id:id,label:label}); };
  sec('rx-sum',t('rxSummary')); sec('rx-prac',t('rxPractice'));
  RX.orderOf(Lc).forEach(function(id){ const c=ix.cards[id]&&ix.cards[id].card; if(c && c.kind!=='deep') rows.push({card:id,label:c.title||''}); });
  sec('rx-deep',t('rxDeep')); sec('rx-gaps',t('rxGaps'));
  return rows;
}
function rxTocGo(r){
  if(r.card){ rxGoCard(r.card); return; }
  if(r.id==='rx-prac'){ const rb=document.querySelector('.rx-rail .rx-mode'); if(rb && rb.offsetParent){ rb.focus(); return; } } // 辅助栏が出ている幅では演習はそちら（常に見えている）
  const n=document.getElementById(r.id); if(n){ if(n.tagName==='DETAILS') n.open=true; n.scrollIntoView({block:'start'}); }
}
function rxOpenToc(Lc){
  const rows=rxTocRows(Lc,document);
  openModal(modalShell(t('rdrToc'),[ el('div',{class:'rx-toc'},rows.map(function(r){
    return el('button',{class:'rx-toc-i jp'+(r.card?'':' rx-toc-sec'),text:r.label,onclick:function(){ closeModal(); rxTocGo(r); }}); })) ]));
}
/* 宽屏の左目次（≥1200 で表示・sticky）：読んでいる所を追って強調（scrollspy：U-39 後半の样张） */
function rxSideToc(Lc,mainCol){
  const rows=rxTocRows(Lc,mainCol);
  const list=el('div',{class:'rx-stoc-l'},rows.map(function(r){ // 条目は最大 2 行で省略（総指挥 2026-10-12）。全名はマウスなら title、タッチなら長押しで一時的に全部出す
    const b=el('button',{class:'rx-stoc-i jp'+(r.card?'':' rx-stoc-sec'),'data-target':r.card?('rxc-'+r.card):r.id,title:r.label,onclick:function(e){ if(b._lp){ b._lp=false; e.preventDefault(); return; } rxTocGo(r); }},[
      el('span',{class:'rx-stoc-t',text:r.label}) ]);
    let tm=null;
    b.addEventListener('pointerdown',function(e){ if(e.pointerType!=='touch') return; tm=setTimeout(function(){ tm=null; b._lp=true; b.classList.add('full'); setTimeout(function(){ b.classList.remove('full'); },2500); },500); });
    ['pointerup','pointerleave','pointercancel'].forEach(function(ev){ b.addEventListener(ev,function(){ if(tm){ clearTimeout(tm); tm=null; } }); });
    b.addEventListener('contextmenu',function(e){ if(b._lp) e.preventDefault(); });
    return b; }));
  return el('nav',{class:'rx-stoc','aria-label':t('rdrToc')},[ el('div',{class:'rx-stoc-in'},[ el('div',{class:'rx-stoc-h jp',text:t('rdrToc')}), list ]) ]);
}
let rxSpyRaf=0;
function rxSpy(){
  if(rxSpyRaf) return;
  rxSpyRaf=requestAnimationFrame(function(){ rxSpyRaf=0;
    const nav=document.querySelector('#view .rx-stoc'); if(!nav || !nav.offsetParent) return;
    const items=[].slice.call(nav.querySelectorAll('.rx-stoc-i')), line=(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h'))||52)+96;
    let cur=null;
    items.forEach(function(b){ const n=document.getElementById(b.dataset.target); if(n && n.offsetParent && n.getBoundingClientRect().top<=line) cur=b; });
    const L=App.rxLand; if(L && Date.now()<L.until){ const lb=items.filter(function(b){ return b.dataset.target===(L.gaps?'rx-gaps':'rxc-'+L.card); })[0]; if(lb) cur=lb; } // 落点の強調中は落点のカードを今の項目に（命題行を 1/3 に置くと、卡頭が判定線より下に残って上のカードを指していた：复验 N-C）
    if(!cur) cur=items[0];
    items.forEach(function(b){ const on=(b===cur); b.classList.toggle('on',on); if(on) b.setAttribute('aria-current','location'); else b.removeAttribute('aria-current'); });
    const box=nav.querySelector('.rx-stoc-in'); if(cur && box){ const br=box.getBoundingClientRect(), cr=cur.getBoundingClientRect();
      if(cr.top<br.top+40) box.scrollTop-=(br.top+40-cr.top); else if(cr.bottom>br.bottom-40) box.scrollTop+=(cr.bottom-br.bottom+40); }
  });
}
window.addEventListener('scroll',rxSpy,{passive:true});
/* 宽屏の右辅助栏（≥1440 で表示・sticky）：この回の掌握度・演習・今日の復習。演習は本文側を隠してこちらだけにする（同じものを二度見せない） */
function rxRail(Lc){
  const m=RX.mastery(Lc,lsGet(nk('rx:sched'),null)), tot=Math.max(1,m.mastered+m.learning+m.new);
  const seg=function(cls,n){ return el('i',{class:cls,style:'flex-grow:'+n+';flex-basis:'+(n?'0':'0')}); };
  const kids=[ el('div',{class:'rx-rail-card'},[ el('p',{class:'rx-rail-m jp',text:rxMasteryLine(Lc)}),
    el('div',{class:'rx-rail-bar','aria-hidden':'true'},[ seg('ma',m.mastered), seg('le',m.learning), seg('ne',m.new||(tot===1?1:0)) ]) ]) ];
  const prac=rxPracticeBar(Lc); if(prac){ prac.classList.add('rx-prac-rail'); kids.push(prac); }
  const q=rxQueue();
  kids.push(rxReviewNode(q));
  return el('aside',{class:'rx-rail','aria-label':t('rxPractice')},[ el('div',{class:'rx-rail-in'},kids) ]);
}
/* 読みかけ：回次ページで最初に見えているカードと、その中の位置を覚える（書き手だけ・間引き）。首页の「続きから読む」で戻る */
let rxReadTimer=null;
function rxReadSave(){
  if(rxReadTimer) return;
  rxReadTimer=setTimeout(function(){ rxReadTimer=null;
    const pg=document.querySelector('#view .rx-lecture[data-lec]'); if(!pg || !isRxCourse() || !writerOk) return;
    const top=(parseFloat(getComputedStyle(document.body).paddingTop)||52)+8;
    const card=Array.prototype.find.call(pg.querySelectorAll('.rx-card'),function(c){ return c.getBoundingClientRect().bottom>top; });
    lsSet(nk('rx:read'),{lec:pg.getAttribute('data-lec'),card:card&&window.scrollY>200?card.id.replace(/^rxc-/,''):null,off:card?Math.round(top-card.getBoundingClientRect().top):0});
  },600);
}
window.addEventListener('scroll',rxReadSave,{passive:true});
function rxResume(rd){
  renderRxLecture(rd.lec,rd.card||null);
  if(rd.card){ requestAnimationFrame(function(){ const n=document.getElementById('rxc-'+rd.card); if(!n) return;
    const top=(parseFloat(getComputedStyle(document.body).paddingTop)||52)+8; window.scrollTo(0,window.scrollY+n.getBoundingClientRect().top-top+(rd.off||0)); }); }
}

/* ---------- カード ---------- */
function rxCard(c){
  if(RXR && RXR.view==='read') return rxCardRead(c);
  const ix=App.rx.ix, opt={cardId:c.id};
  const head=el('div',{class:'rx-card-hd'},[ el('h3',{class:'jp',text:c.title||''}) ]);
  const body=el('div',{class:'rx-card-bd'});
  const card=el('article',{class:'rx-card rx-k-'+c.kind,id:'rxc-'+c.id},[head,body]);
  const P=function(pid){ return rxPL(pid,c.id,opt); };
  if(c.names) body.appendChild(el('p',{class:'rx-names jp',text:c.names}));
  (c.fields||[]).forEach(function(f){
    const lines=(f.props||[]).map(P).filter(Boolean);
    (f.variants||[]).forEach(function(vid){ const ve=ix.variants[vid]; if(ve && !ve.quiz) lines.push(rxVariantLine(ve.variant)); }); // 真題由来の変体は出さない（データ側の誤参照の保険）
    if(f.text) lines.push(el('p',{class:'rx-f-tx jp',text:f.text})); // 栏的补足文字（命题と併存しうる）
    if(!lines.length) return;
    body.appendChild(el('div',{class:'rx-f'},[ el('div',{class:'rx-f-l jp',text:f.label||''}), el('div',{class:'rx-f-b'},lines) ]));
  });
  if(c.symptoms && c.symptoms.length) body.appendChild(el('p',{class:'rx-sym jp',text:c.symptoms.join('・')}));
  if(c.rows && c.cols) body.appendChild(rxTable(c));
  if(c.kind==='figure') body.appendChild(rxFigure(c));
  if(c.kind==='photo') body.appendChild(rxPhoto(c));
  (c.blocks||[]).forEach(function(b){
    const refs=(b.refs||[]).map(function(r){ return ix.refs[r]&&ix.refs[r].short; }).filter(Boolean);
    body.appendChild(el('div',{class:'rx-blk'},[ el('p',{class:'jp',text:b.text||''}), refs.length?el('div',{class:'rx-refs jp',text:refs.join('・')}):null ].filter(Boolean)));
  });
  { // カード下の命題一覧（方案 2-1 第 3 項）：表の行・カード級の props・段落の命題。一覧の中では重ねない
    const seen={}, lines=[], add=function(pid){ if(pid && !seen[pid]){ seen[pid]=1; const l=P(pid); if(l) lines.push(l); } };
    if(c.rows && c.cols) c.rows.forEach(function(r){ (r.props||[]).forEach(add); });
    if(RXR){ (c.props||[]).forEach(add); (c.blocks||[]).forEach(function(b){ (b.props||[]).forEach(add); }); } // 描画中の回のページだけ（現行で画いていなかった命題も一行ずつ：未画命題 0）
    if(lines.length) body.appendChild(el('div',{class:'rx-tprops'},lines));
  }
  if(c.kind!=='deep' && c.kind!=='figure' && c.kind!=='photo') head.appendChild(rxHideToggle(card));
  const links=rxCardLinks(c); if(links) body.appendChild(links);
  return card;
}

function rxCardRead(c){ // 「読む」：讲解块・図・表・症例・症状を前に、命題は「根拠を見る（n）」に畳む。讲解块の無いカードは ★★★ だけ全文（降級）
  const ix=App.rx.ix, head=el('div',{class:'rx-card-hd'},[ el('h3',{class:'jp',text:c.title||''}) ]), body=el('div',{class:'rx-card-bd'});
  const card=el('article',{class:'rx-card rx-read rx-k-'+c.kind,id:'rxc-'+c.id},[head,body]);
  const ex=(ix.explain&&ix.explain[c.id])||[], seenTri={}, first=[];
  ex.forEach(function(b){ // 讲解块：一段ずつ。直下に、挂かる命題のうち三栏のあるものの「試験では」を一行ずつ（カード内で重ねない：M8）
    body.appendChild(el('div',{class:'rx-explain jp','data-explain':b.id,text:b.text||''}));
    const tl=[]; (b.props||[]).forEach(function(pid){ const e=ix.props[pid]; if(first.indexOf(pid)<0) first.push(pid); if(!e || !e.prop.triple || seenTri[pid]) return; seenTri[pid]=1; tl.push(rxTriExamLine(e.prop)); });
    if(tl.length) body.appendChild(el('div',{class:'rx-tprops rx-xtri'},tl)); });
  if(c.names) body.appendChild(el('p',{class:'rx-names jp',text:c.names}));
  if(c.kind==='figure') body.appendChild(rxFigure(c,{noAns:true}));
  if(c.kind==='photo') body.appendChild(rxPhoto(c,{noAns:true}));
  if(c.rows && c.cols) body.appendChild(rxTable(c));
  (c.blocks||[]).forEach(function(b){ body.appendChild(el('div',{class:'rx-blk'},[ el('p',{class:'jp',text:b.text||''}) ])); });
  if(c.symptoms && c.symptoms.length) body.appendChild(el('p',{class:'rx-sym jp',text:c.symptoms.join('・')}));
  const all=RX.cardProps(c).filter(function(pid){ return ix.props[pid]; }), opt={cardId:c.id};
  let folded=all;
  if(!ex.length){ const top=all.filter(function(pid){ return ix.props[pid].prop.imp>=3; }); // 降級：このカードでいちばん要る数句
    if(top.length) body.appendChild(el('div',{class:'rx-tprops rx-top3'},top.map(function(pid){ return rxPropLine(ix.props[pid].prop,opt); })));
    folded=all.filter(function(pid){ return top.indexOf(pid)<0; }); }
  else folded=first.concat(all.filter(function(pid){ return first.indexOf(pid)<0; })).filter(function(pid){ return ix.props[pid]; });
  if(folded.length){ const d=el('details',{class:'rx-basis'},[ el('summary',{class:'jp',text:tf('rxBasisN',{n:folded.length})}) ]);
    folded.forEach(function(pid){ d.appendChild(rxPropLine(ix.props[pid].prop,opt)); }); body.appendChild(d); }
  if(c.kind!=='deep' && c.kind!=='figure' && c.kind!=='photo') head.appendChild(rxHideToggle(card));
  const links=rxCardLinks(c); if(links) body.appendChild(links);
  return card;
}

function rxVariantLine(v){
  return el('div',{class:'rx-var'},[
    el('span',{class:'rx-var-x','aria-hidden':'true',text:'✕'}), el('span',{class:'rx-var-t jp',text:v.text||''}),
    v.correct?el('div',{class:'rx-var-c jp'},[ el('span',{class:'rx-var-lb',text:t('rxCorrectIs')}), document.createTextNode(v.correct) ]):null
  ].filter(Boolean));
}

function rxTable(c){
  const thead=el('thead',null,[ el('tr',null,c.cols.map(function(h){ return el('th',{class:'jp',text:h||''}); })) ]);
  const tbody=el('tbody',null,c.rows.map(function(r){
    const cells=r.cells||[r.label].concat(r.cells||[]);
    return el('tr',null,cells.map(function(x,i){ const tx=x==null?'':String(x); return el(i===0?'th':'td',{class:'jp'+(tx.length<=8?' rx-nw':tx.length>=16?' rx-long':''),text:tx}); }));
  }));
  return el('div',{class:'rx-tbl-w'},[ el('table',{class:'rx-tbl'},[thead,tbody]) ]);
}

/* 遮挡回忆：遮住各栏正文（标题与栏名保留），点栏显示。遮りはカードごとに覚える（この起動の間だけ・保存しない）：{カード要素 id: 開けた欄の番号[]} */
const RX_HID={};
function rxHideToggle(card){ // 隠しているあいだ、各欄・表の各セルは「答えを見る」ボタン（読み上げに答えを出さない・キーボードで一つずつ開ける：S6 U-08）
  const UNIT='.rx-f-b,.rx-tprops,.rx-tbl td';
  const mute=function(u,on){ // 隠している間は中身を読み上げ木から外す（ボタン名「答えを見る」の下に答えが見えていた：Codex 复查 U-08）。文字だけの子は span に包んでから外す
    if(on){ [].slice.call(u.childNodes).forEach(function(n){
      if(n.nodeType===3){ if(!n.nodeValue.trim()) return; const w=el('span',{'data-rxmute':'1'}); u.insertBefore(w,n); w.appendChild(n); n=w; }
      if(n.nodeType===1 && !n.hasAttribute('aria-hidden')){ n.setAttribute('aria-hidden','true'); n.setAttribute('data-rxmute','1'); } }); }
    else u.querySelectorAll('[data-rxmute]').forEach(function(n){ if(n.parentNode===u){ n.removeAttribute('aria-hidden'); n.removeAttribute('data-rxmute'); } });
  };
  const plain=function(u){ ['role','tabindex','aria-label'].forEach(function(a){ u.removeAttribute(a); }); mute(u,false); };
  const arm=function(on){ card.querySelectorAll(UNIT).forEach(function(u){ u.classList.remove('rx-shown'); plain(u);
    if(on){ u.setAttribute('role','button'); u.setAttribute('tabindex','0'); u.setAttribute('aria-label',t('rxHideCell')); mute(u,true); } }); };
  const reveal=function(u){ if(u.classList.contains('rx-shown')) return; u.setAttribute('tabindex','-1'); u.classList.add('rx-shown'); u.removeAttribute('role'); u.removeAttribute('aria-label'); mute(u,false); // tabindex を先に -1 に：外すと焦点が落ちる（Chromium）
    const m=RX_HID[card.id], i=[].indexOf.call(card.querySelectorAll(UNIT),u); if(m && i>=0 && m.indexOf(i)<0) m.push(i); };
  const set=function(on){ card.classList.toggle('rx-hidden',on); b.setAttribute('aria-pressed',String(on)); b.textContent=on?t('rxHideOff'):t('rxHideMode'); arm(on);
    if(on) RX_HID[card.id]=[]; else delete RX_HID[card.id]; };
  const b=el('button',{class:'rx-hide-t jp','aria-pressed':'false',text:t('rxHideMode'),onclick:function(){ set(!card.classList.contains('rx-hidden')); }});
  card.__rxHide=set; // 落点（rxGoCard）が目標のカードだけを解くための口
  const kept=RX_HID[card.id]; // 描き直し（検索から戻る・書き手の交代など）で遮りと開けた欄を戻す（CR-04・N-01：DOM の類だけにあって全部外れていた）
  if(kept){ const units=card.querySelectorAll(UNIT); set(true); kept.forEach(function(i){ if(units[i]) reveal(units[i]); }); }
  card.addEventListener('click',function(e){ if(!card.classList.contains('rx-hidden')) return; const u=e.target.closest(UNIT); if(u) reveal(u); });
  card.addEventListener('keydown',function(e){ if(!card.classList.contains('rx-hidden') || (e.key!=='Enter'&&e.key!==' ')) return;
    const u=e.target.closest&&e.target.closest(UNIT); if(u && u.getAttribute('role')==='button'){ e.preventDefault(); reveal(u); } });
  return b;
}

/* ---------- 図（原創 SVG を内联：脚本・事件属性を除き、id を卡片前缀で一意化し、<style> を本図に閉じ込める） ---------- */
function rxFigure(c,fo){ fo=fo||{};
  const holder=el('div',{class:'rx-fig',role:'group','aria-label':c.alt||c.title||''});
  const cap=el('div',{class:'rx-fig-ans'});
  fetch(App.course.dir+'/figures/'+c.svg,{cache:'no-store'}).then(function(r){ if(!r.ok) throw new Error(r.status); return r.text(); })
    .then(function(txt){ const svg=rxSafeSvg(txt,'rxf-'+c.id); if(!svg){ holder.appendChild(el('p',{class:'rx-alt jp',text:c.alt||''})); return; }
      holder.appendChild(svg);
      holder.appendChild(el('button',{class:'rc-zoom','aria-label':t('figZoom'),title:t('figZoom'),onclick:function(){ openViewer({svg:svg.cloneNode(true),title:c.title||c.alt||t('figTitle'),alt:c.alt||''}); }},[ el('span',{html:NEW_ICONS.search}) ])); })
    .catch(function(){ holder.appendChild(figIsOffline()?figOfflineNode():el('p',{class:'rx-alt jp',text:c.alt||''})); }); // オフラインで取れない図は占位（K2-13）
  const ans=fo.noAns?[]:(c.answers||[]).map(function(pid){ if(RXR) return rxPL(pid,c.id,{cardId:c.id}); const e=App.rx.ix.props[pid]; return e?rxPropLine(e.prop,{noTriple:true}):null; }).filter(Boolean);
  if(ans.length){ cap.appendChild(el('div',{class:'rx-f-l jp',text:t('rxFigAns')})); ans.forEach(function(x){ cap.appendChild(x); }); }
  return el('div',null,[holder,cap]);
}
function rxSafeSvg(txt,pre){
  let doc; try{ doc=new DOMParser().parseFromString(txt,'image/svg+xml'); }catch(e){ return null; }
  const svg=doc.documentElement; if(!svg || svg.nodeName.toLowerCase()!=='svg' || doc.querySelector('parsererror')) return null;
  svg.querySelectorAll('script,foreignObject').forEach(function(n){ n.remove(); });
  const ids={};
  svg.querySelectorAll('*').forEach(function(n){
    Array.prototype.slice.call(n.attributes).forEach(function(a){ if(/^on/i.test(a.name)) n.removeAttribute(a.name); });
    if(n.id){ ids[n.id]=pre+'-'+n.id; n.id=ids[n.id]; }
  });
  const fix=function(v){ return v.replace(/url\(#([^)]+)\)/g,function(m,id){ return ids[id]?'url(#'+ids[id]+')':m; })
                          .replace(/^#(.+)$/,function(m,id){ return ids[id]?'#'+ids[id]:m; }); };
  svg.querySelectorAll('*').forEach(function(n){
    ['fill','stroke','clip-path','mask','filter','marker-start','marker-mid','marker-end','href','xlink:href'].forEach(function(k){ const v=n.getAttribute(k); if(v) n.setAttribute(k,fix(v)); });
    ['aria-labelledby','aria-describedby'].forEach(function(k){ const v=n.getAttribute(k); if(v) n.setAttribute(k,v.split(/\s+/).map(function(id){ return ids[id]||id; }).join(' ')); });
  });
  ['aria-labelledby','aria-describedby'].forEach(function(k){ const v=svg.getAttribute(k); if(v) svg.setAttribute(k,v.split(/\s+/).map(function(id){ return ids[id]||id; }).join(' ')); });
  svg.id=pre;
  svg.querySelectorAll('style').forEach(function(st){ // セレクタを #pre で閉じ込める（内联 SVG の <style> は文書全体に効くため）
    st.textContent=st.textContent.replace(/(^|\})\s*([^{}@]+)\{/g,function(m,end,sel){
      return end+' '+sel.split(',').map(function(x){ return '#'+pre+' '+x.trim(); }).join(',')+'{'; });
  });
  svg.removeAttribute('width'); svg.removeAttribute('height');
  return document.importNode(svg,true);
}

/* 外部実図：図の傍に署名（credit）を必ず表示。画像が無いときは alt、署名は残す。 */
function rxPhoto(c,fo){ fo=fo||{};
  const im=((App.rx.content.images||[]).filter(function(x){ return x.id===c.image; })[0])||null;
  const kids=[];
  if(im && im.file){ const ph=el('img',{class:'rx-photo',src:App.course.dir+'/images/'+im.file,alt:c.alt||'',loading:'lazy'}), pw=el('div',{class:'rx-photo-w'},[ ph ]); figImgFallback(ph,pw); kids.push(pw); }
  else kids.push(el('p',{class:'rx-alt jp',text:c.alt||''}));
  if(im && im.credit) kids.push(el('p',{class:'rx-credit',text:im.credit}));
  const ans=fo.noAns?[]:(c.answers||[]).map(function(pid){ if(RXR) return rxPL(pid,c.id,{cardId:c.id}); const e=App.rx.ix.props[pid]; return e?rxPropLine(e.prop,{noTriple:true}):null; }).filter(Boolean);
  if(ans.length){ kids.push(el('div',{class:'rx-f-l jp',text:t('rxFigAns')})); ans.forEach(function(x){ kids.push(x); }); }
  return el('div',{class:'rx-photo-w'},kids);
}

/* 講義と標準のずれ：triple を持つ命題の一覧。三栏本体はカード側（首次出現）にだけ置き、ここは跳转のみ（同一命題の三栏は回内に 1 つ）。 */
function rxTriHome(pid){ // 三栏を印すカード：欄か表の一覧にこの命題の行があるカード。図・写真の答え（三栏なし）とカード級 props（画かない）の首卡は数えない（D1-F02：首卡索引のままだと三栏が頁のどこにも出なかった）
  const ix=App.rx.ix, l=ix.propCards[pid]||[];
  for(let i=0;i<l.length;i++){ const ce=ix.cards[l[i]], c=ce&&ce.card; if(!c) continue;
    const inF=(c.fields||[]).some(function(f){ return (f.props||[]).indexOf(pid)>=0; }), inR=!!(c.rows && c.cols) && c.rows.some(function(r){ return (r.props||[]).indexOf(pid)>=0; });
    if(inF || inR) return l[i]; }
  return null; }
function rxGapsBlock(Lc){
  const ix=App.rx.ix, ps=(Lc.gaps||[]).map(function(pid){ return ix.props[pid]&&ix.props[pid].prop; }).filter(function(p){ return p && p.triple; });
  if(!ps.length) return null;
  const box=el('section',{class:'rx-gaps'},[ el('h2',{class:'rx-bh jp',text:t('rxGaps')}) ]);
  ps.forEach(function(p){
    if(RXR){ const n=rxPL(p.id,'gaps',{}); box.appendChild(el('div',{class:'rx-gap'},(n && n.matches && n.matches('.rx-pref'))?[ el('div',{class:'rx-prop-w'},[n].concat(rxTriTog(p.triple))) ]:[n])); return; } // 本拠でなければ短参照＋その場の比較
    const first=rxTriHome(p.id);
    if(!first){ box.appendChild(el('div',{class:'rx-gap'},[ el('div',{class:'rx-prop-w'},[ rxPropLine(p,{noTriple:true}), rxTriple(p.triple) ]) ])); return; } // 三栏を印すカードが無い：ここで開いて見せる
    box.appendChild(el('div',{class:'rx-gap'},[ rxPropLine(p,{noTriple:true}),
      el('button',{class:'rx-tri-go jp',text:t('rxTriSee'),onclick:function(){ rxGoCard(first,p.id); }}) ]));
  });
  return box;
}

/* ---------- 学习状态（本课命名空间 quiz:<id>:rx:*）。写入一律经 lsSet（单写者守卫）；
 * 每次都从存储重读再写，不持有内存副本（避免旧内存覆盖他处的新写入）。 ---------- */
const RX_KEYS=['rx:sched','rx:stats','rx:log'];
function rxToday(){ return RX.dayIndex(new Date()); }
function rxExamDay(){
  const s=getExamDate()||App.course.examDate||null;
  const m=s&&/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  return m?RX.dayIndex(new Date(+m[1],+m[2]-1,+m[3])):null;
}
function rxSchedRecord(evs){ // 一笔作答の事件（一つ・または配列）＝一つの写入単元（合成稿 v3.3）：rx:log → rx:stats → rx:sched の順に同じ処理の中で書く（増える書きが先）。
  // 戻り値：true＝全部書けた／false＝何も残っていない（待答のまま・帯）／'partial'＝戻しも書けず一部が残った（契約外：判題は出し「未完整保存」を示す。重答は求めない）
  evs=(Array.isArray(evs)?evs:[evs]).filter(function(ev){ return ev && ev.props && ev.props.length; });
  if(!isRxCourse() || !evs.length) return false;
  const kS=nk('rx:sched'), kT=nk('rx:stats'), kL=nk('rx:log'), today=rxToday();
  const po=function(v){ return !!v && typeof v==='object' && !Array.isArray(v); };
  const snap=function(k){ try{ return {v:localStorage.getItem(k)}; }catch(e){ return null; } }, r0={}; [kS,kT,kL].forEach(function(k){ r0[k]=snap(k); });
  if(!r0[kS] || !r0[kT] || !r0[kL]){ noteSave(kS,false); return false; } // 読めないまま書くと上書きで記録を消しうる：書かない
  const parse=function(x){ try{ return x==null?null:JSON.parse(x); }catch(e){ return null; } };
  let sched=parse(r0[kS].v); if(!po(sched)) sched={v:1,props:{}}; if(!po(sched.props)) sched.props={}; // 配列は JSON に残らない（記録が黙って消える）ので作り直す
  let st=null, log=parse(r0[kL].v); if(!Array.isArray(log)) log=[];
  evs.forEach(function(ev){
    ev.props.forEach(function(pid){ sched.props[pid]=RX.schedUpdate(sched.props[pid],!!ev.ok,!!ev.unsure,today); });
    if(!ev.ok && ev.tamper){
      if(!st){ st=parse(r0[kT].v); if(!po(st)) st={v:1}; if(!po(st.byTamper)) st.byTamper={}; if(!po(st.byConceptTamper)) st.byConceptTamper={}; } // 壊れていても作答は止めない
      st.byTamper[ev.tamper]=(st.byTamper[ev.tamper]||0)+1;
      (ev.concepts||[]).forEach(function(c){ const k=c+'|'+ev.tamper; st.byConceptTamper[k]=(st.byConceptTamper[k]||0)+1; });
    }
    log.push({at:Date.now(),p:ev.props,ok:!!ev.ok,u:!!ev.unsure,m:ev.mode||''});
  });
  const wrote=[];
  const put=function(k,val){ if(!lsSet(k,val)) return false; wrote.push(k); return true; };
  const schedBack=function(){ let b; try{ b=JSON.parse(localStorage.getItem(kS)); }catch(e){ return false; } // 「投げなかった」ではなく「保存できた」を確かめる
    return po(b) && po(b.props) && evs.every(function(ev){ return ev.props.every(function(pid){ return po(b.props[pid]); }); }); };
  let fail=null;
  if(!put(kL,log.slice(-500))) fail=kL;
  else if(st && !put(kT,st)) fail=kT;
  else if(!put(kS,sched) || !schedBack()) fail=kS;
  if(!fail){ [kS,kT,kL].forEach(function(k){ noteSave(k,true); }); return true; }
  // 同じ処理の中で逆順に戻す（前に無かった鍵は消す）。待ちは残さない（跨処理・跨タブ・跨重載の待ち状態を持たない：合成稿 v3.3 原則 3）
  let back=true;
  const rb=wrote.slice().reverse(); for(let i=0;i<rb.length;i++){ const k=rb[i]; if(!writerOk){ back=false; break; } if(!(r0[k].v==null?lsDel(k):lsSetRaw(k,r0[k].v))) back=false; } // 一笔ごとに書き手か確かめて書き戻す（lsDel・lsSetRaw の writeAllowed が札を読む）。書き手でなくなったらそこで止め、未完整保存（'partial'）として知らせる：別のタブがもう書いたかもしれない値を古い控えで上書きしない（WLR-B 三：強夺との残る隙間は CHANGELOG に登記、4.3.1 で不強夺）
  noteSave(fail,false); // 保存の故障は帯で知らせる（CR-11）
  return back?false:'partial';
}
/* 個人の重点＝この端末の練習で、誤答または自信なしのまま、まだ習得に至っていない命題。
 * 真題層には作答記録を配布しない（章程第 19 条）ので、解錠の有無に関係なく練習記録だけから決まる。 */
function rxPersonal(sched){
  const out={}, ps=(sched&&sched.props)||{};
  Object.keys(ps).forEach(function(pid){ const x=ps[pid]; if(x && !x.mastered && ((x.wrong|0)>0 || (x.unsure|0)>0)) out[pid]=true; });
  return out;
}
function rxQueue(){ // 个人重点即使没练过也当天进队列（E-44）
  const today=rxToday(), sched=lsGet(nk('rx:sched'),null)||{v:1,props:{}}, personal=rxPersonal(sched);
  const view={props:Object.assign({},sched.props||{})};
  return RX.dueQueue(App.rx.ix,view,today,{examDay:rxExamDay(),quizStmts:App.rx.quizStmts||{},personal:personal});
}
const RX_REVIEW_BATCH=20; // 今日の復習の一轮（ホームの「{k} 件ずつ」と同じ値）
/* 今日の復習の入口（U-52）：あれば全幅の主ボタン、なければ押せない「完了」の一行（灰色の禁用ボタンは押せそうに見える） */
function reviewDoneNode(){ return el('div',{class:'rx-done jp'},[ el('span',{class:'rx-done-i','aria-hidden':'true',html:NEW_ICONS.check}), el('span',{text:t('rxReviewNone')}) ]); } // 旧課の首页も同じ行（総指揮 2026-10-13）
function rxReviewNode(q){
  if(!q.list.length) return reviewDoneNode();
  return el('button',{class:'btn rx-review',onclick:rxReviewRun,text:t('rxReviewToday')+'　'+t('rxReviewN').replace('{n}',q.list.length)});
}
function rxReviewRun(){
  const q=rxQueue(), ix=App.rx.ix;
  const items=q.list.slice(0,RX_REVIEW_BATCH).map(function(pid){
    const p=ix.props[pid].prop, vs=(p.variants||[]).filter(function(v){ return v.text && v.wrong; });
    return rxTFItem(p, vs.length && App.rng()<0.5 ? vs[Math.floor(App.rng()*vs.length)] : null);
  });
  rxRun('rxReviewToday',items,null);
}

/* ---------- ホームの付加部（今日の復習・週の流れ・回ごとの掌握度・よく引っかかる型） ---------- */
function rxHomeExtras(){
  const ix=App.rx.ix, kids=[], q=rxQueue();
  const hint=rxWeekHint(); if(hint) kids.push(el('p',{class:'rx-hint jp',text:hint}));
  const ed=rxExamDay(), today=rxToday();
  if(q.sprint && ed!==null) kids.push(el('p',{class:'rx-hint jp',text:t('rxSprint').replace('{d}',ed-today)}));
  kids.push(rxReviewNode(q));
  if(q.list.length>RX_REVIEW_BATCH) kids.push(el('p',{class:'rx-batch jp',text:tf('rxReviewBatch',{k:RX_REVIEW_BATCH})})); // U-89: 37 件と出て 1/20 から始まる食い違いを先に言う
  const vs=rxVaultState();
  if(vs==='unlocked'){
    if(App.rx.vault.test) kids.push(el('p',{class:'rx-test jp',text:t('rxTestData')}));
    kids.push(el('button',{class:'btn ghost rx-mock',text:t('rxModeMock'),onclick:rxMockRun}));
  } else if(vs==='locked'){
    kids.push(el('div',{class:'rx-locked'},[ el('span',{class:'rx-lock-i','aria-hidden':'true',html:NEW_ICONS.lock}),
      el('span',{class:'jp',text:t('rxLocked')}), el('button',{class:'btn ghost sm',text:t('rxUnlockBtn'),onclick:rxUnlockDialog}) ]));
  }
  const top=RX.topTamper(lsGet(nk('rx:stats'),null),3);
  if(top.length){
    kids.push(el('h2',{class:'rx-bh jp',text:t('rxTopTamper')}));
    kids.push(el('ul',{class:'rx-lines jp'},top.map(function(x){ return el('li',{text:(typeof rxTamperName==='function'?rxTamperName(x.code,ix.tamper[x.code]):(ix.tamper[x.code]||x.code))+'（'+x.n+'）'}); })));
  }
  return kids;
}
function rxWeekHint(){ // 月曜授業を前提：日・月＝前回の一枚要点、月＝授業のあと本回の★★★、金＝たまった復習
  const d=new Date().getDay();
  if(d===0) return t('rxHintBefore');
  if(d===1) return t('rxHintBefore')+'　'+t('rxHintAfter');
  if(d===5) return t('rxHintFri');
  return '';
}
function rxMasteryBar(Lc){
  const m=RX.mastery(Lc,lsGet(nk('rx:sched'),null));
  const seg=function(cls,n){ return el('i',{class:cls,style:'flex-grow:'+n}); };
  return el('span',{class:'rx-rail-bar rx-lec-bar','aria-hidden':'true'},[ seg('ma',m.mastered), seg('le',m.learning), seg('ne',m.new) ]);
}
function rxMasteryLine(Lc){
  const m=RX.mastery(Lc,lsGet(nk('rx:sched'),null));
  return t('rxMastery').replace('{a}',m.mastered).replace('{b}',m.learning).replace('{c}',m.new);
}

/* ---------- 書き出し・取り込み（本課の rx:* と試験日だけ。X7-05 の教訓：取り消し用バックアップを先に書いて確認、
 * 各書き込みの戻り値を確認、失敗したら全部元に戻す。他課・旧課の鍵には触れない） ---------- */
function rxExportState(){
  return { v:1, sched:lsGet(nk('rx:sched'),null), stats:lsGet(nk('rx:stats'),null), log:lsGet(nk('rx:log'),null), examDate:getExamDate() };
}
function rxValidState(r){ // 取り込む新課の状態：入れ子の構造と型まで確かめる（壊れたものは丸ごと拒む。取り込み後に作答で落ちない）
  const plain=function(v){ return !!v && typeof v==='object' && !Array.isArray(v); };
  const cnt=function(v){ return Number.isInteger(v) && v>=0 && v<1e9; };
  const day=function(v){ return Number.isInteger(v) && v>=0 && v<1e6; };
  if(!plain(r) || r.v!==1) return false;
  if(r.sched!==null){
    if(!plain(r.sched) || (r.sched.v!==undefined && r.sched.v!==1) || !plain(r.sched.props)) return false;
    const ks=Object.keys(r.sched.props); if(ks.length>50000) return false;
    for(const k of ks){ const x=r.sched.props[k];
      if(!plain(x) || !(Number.isInteger(x.box) && x.box>=0 && x.box<RX.INTERVALS.length) || !day(x.due)
        || !cnt(x.streak) || !cnt(x.wrong) || !cnt(x.seen) || (x.unsure!==undefined && !cnt(x.unsure))
        || !(x.lastOkDay===null || day(x.lastOkDay)) || typeof x.mastered!=='boolean') return false; }
  }
  if(r.stats!==null){
    if(!plain(r.stats) || r.stats.v!==1 || !plain(r.stats.byTamper) || !plain(r.stats.byConceptTamper)) return false;
    for(const k in r.stats.byTamper) if(!cnt(r.stats.byTamper[k])) return false;
    for(const k in r.stats.byConceptTamper) if(!cnt(r.stats.byConceptTamper[k])) return false;
  }
  if(r.log!==null){
    if(!Array.isArray(r.log) || r.log.length>500) return false;
    for(const e of r.log) if(!plain(e) || !Number.isFinite(e.at) || !Array.isArray(e.p) || !e.p.every(function(x){ return typeof x==='string'; })
      || typeof e.ok!=='boolean' || typeof e.u!=='boolean' || typeof e.m!=='string') return false;
  }
  return r.examDate===null || r.examDate===undefined || (typeof r.examDate==='string' && /^\d{4}-\d{2}-\d{2}$/.test(r.examDate));
}
/* 新課の取り込み・取り消し：旧課と同じ仕組み（importBackup に「途中」の印つきで退避→書き込み→完了で印を外す）。
 * 守卫（importBlocked・holdsWriter）は applyImportPayload／undoImport の冒頭と、ここ自身の冒頭の両方で確かめる。
 * 失敗時：書き手を外れていたら巻き戻さない（新しい書き手のデータを上書きしない）；戻しきれたときだけ「元のまま」と言う。 */
function rxImportKeys(){ return RX_KEYS.concat(['examDate']); }
function rxApplyImport(obj){
  if(importBlocked()) throw Object.assign(new Error('import blocked'),{restoreFailed:true}); // 直接呼ばれても同じ守卫（前回が途中で止まっていれば拒む）
  if(!holdsWriter()) throw writerOk ? Object.assign(new Error(t('storageBlocked')),{plain:true}) : Object.assign(new Error('not writer'),{ownershipLost:true}); // 書き手のまま札が読めない＝保存の故障：そう知らせる（失権なら黙って帯に任せる）
  if(!obj || obj._kind!=='quiz-progress-export') throw new Error(t('impBadFile'));
  if(!importForThisCourse(obj)) throw Object.assign(new Error(t('impWrongCourse')),{plain:true}); // 別の課のファイル・課程 ID が無効なファイル：そのまま見せる文で拒む（「形式が不正です」とは言わない：B-057・X15-01）
  if(!rxValidState(obj.rx)) throw new Error(t('impBadFile'));
  const keys=rxImportKeys(), raw={};
  keys.forEach(function(k){ raw[k]=localStorage.getItem(nk(k)); });
  const backup={at:new Date().toISOString(),data:raw,keys:keys};
  const r=obj.rx, vals={'rx:sched':r.sched,'rx:stats':r.stats,'rx:log':r.log,'examDate':r.examDate==null?null:r.examDate};
  const sig={}; keys.forEach(function(k){ const v=vals[k]; sig[k]=(v===null||v===undefined)?null:importSig(JSON.stringify(v)); }); // 取り込む値の要約を書く前に退避へ（WLR2 必修 1・WLR-B2 WLB2-01）
  const hadBackupMark=hasUnsaved(nk('importBackup')); // 前から書けずにいた退避印（印が「途中」のまま残っている真の未決）は、今回の中止で消さない（X15f-01）
  if(!importBackupStart(backup,sig)){ if(!hadBackupMark) forgetUnsaved(nk('importBackup')); throw writerOk ? Object.assign(new Error(t('storageBlocked')),{plain:true}) : Object.assign(new Error('backup not saved'),{ownershipLost:true}); } // 退避を確かめてから書く（できなければ学習データに触れる前に中止：退避印の「書けずにいた」は外す：X15e-01）
  try{
    keys.forEach(function(k){ const v=vals[k];
      if(v===null||v===undefined){ if(localStorage.getItem(nk(k))!==null && !lsDel(nk(k))) throw new Error(k+' not removed'); }
      else if(!importPut(backup,function(){ return lsSet(nk(k),v); })) throw new Error(k+' not saved'); // 書けなければ要約を外して一度だけやり直す（WLR-B3）
    });
  }catch(err){
    if(!writerOk || fenceState()==='lost'){ if(writerOk) setWriter(false); loadProgress(); err.ownershipLost=true; throw err; } // 本当に書き手を外れたときだけ巻き戻さない。札が読めないだけ（保存の故障）なら巻き戻しを試す
    const restored=restoreRaw(raw,keys);
    loadProgress();
    if(restored){ importBackupDrop(backup); throw Object.assign(new Error(t('rxImpFail')),{plain:true}); } // 戻せた：取り消すものは無い
    if(writerOk){ importSigBack(backup,sig); err.restoreFailed=true; err.noUndo=!importBackupHasSig(); } else err.ownershipLost=true; // 戻しきれない：印つきのバックアップが残る。要約つきなら次の取り込みは止まり取り消しで戻せる、要約なし（降級）ならどちらも言わない（WLR-B4）
    throw err;
  }
  const noUndo=!importBackupDone(backup); // 完了：印を外す。降級した取り込みは退避を消して知らせる（WLR-B3）
  return { applied:keys.filter(function(k){ return vals[k]!==null && vals[k]!==undefined; }), skipped:[], noUndo:noUndo };
}
function rxUndoImport(){
  if(!holdsWriter()) return; // 直接呼ばれても書き手であることを札まで確かめる
  const b=lsGet(nk('importBackup'),null);
  if(!b||!b.data){ alert(t('impNoBackup')); return; }
  const keys=b.keys||rxImportKeys();
  if(!b.sig){ alert(t('impUndoUnverified')); return; } // 照合できない（古い版の退避）：戻さない（WLR2 必修 1）
  if(!importUnchanged(b,keys)){ alert(t('impUndoChanged')); return; } // 取り込みのあとに記録が変わった：戻さない（WLR1 WL-02）
  if(!markBackup(b,'pending',true)){ if(writerOk) alert(t('impRestoreFailed')); return; } // 書き戻す前に「途中」の印
  if(!restoreRaw(b.data,keys)){ loadProgress(); if(writerOk) alert(t('impRestoreFailed')); return; } // 途中で止まった：印つきのバックアップは消さない
  lsDel(nk('importBackup'));
  dataReplaced(); location.reload();
}

/* ---------- 跨课链接（全局概念 g:<slug>） ----------
 * 新课之间按命题的 concepts 互链；旧两课没有全局概念 id，只用映射表（content.legacy：g:→{旧课 ID: 旧课概念名}）单向链到旧课概念页，旧课数据不改。
 * 概念显示名取 content.concepts[g:].ja；没有显示名的概念不出 chip（不把内部键给人看）。 */
function rxOtherCourses(){ return courseList().filter(function(c){ return c.contract===RX.CONTRACT && (!App.course || c.id!==App.course.id); }); }
function rxPrefetchOthers(){ // 背景で他の新課の content を取り、関連リンクと切替の浮きの件数に使う（失敗しても何も起きない）
  const me=App.rx; App.rxOther=App.rxOther||{};
  rxOtherCourses().forEach(function(c){
    if(App.rxOther[c.id]) return;
    fetchJSONv(c.dir+'/content.json').then(function(v){
      if(!v || !v.data || v.data.schema!==RX.CONTRACT) return;
      App.rxOther[c.id]={meta:c,content:v.data,ix:RX.buildIndex(v.data)};
      if(me && App.rx===me) rxRefreshLinks(); // 表示中のカードにだけ差し込む（再描画しない＝読む位置・開閉を崩さない）
      rxCourseRowRefresh(c.id);
    }).catch(function(){});
  });
}
function rxIndexOf(cid){ // その課のいまの索引（表示中の課＝App.rx、ほかの新課＝背景取得したもの）。まだ無ければ null
  if(App.course && App.course.id===cid && App.rx && App.rx.ix) return App.rx.ix;
  const o=App.rxOther && App.rxOther[cid];
  return o?o.ix:null;
}
/* 预取缓存跨课保留；用时排除当前课（切课后当前课也在缓存里） */
function rxOthers(){ const me=App.course&&App.course.id; return Object.keys(App.rxOther||{}).filter(function(k){ return k!==me; }).map(function(k){ return App.rxOther[k]; }); }
function rxConceptLabel(slug){
  const all=[App.rx&&App.rx.content].concat(rxOthers().map(function(o){ return o.content; }));
  for(const ct of all){ const m=ct&&ct.concepts&&ct.concepts[slug]; if(m && typeof m.ja==='string' && m.ja) return m.ja; }
  return null;
}
function rxConceptsOfCard(c){
  const ix=App.rx.ix, out=[];
  RX.cardProps(c).forEach(function(pid){ const e=ix.props[pid]; ((e&&e.prop.concepts)||[]).forEach(function(g){ if(out.indexOf(g)<0) out.push(g); }); });
  return out;
}
/* 他の新課で同じ概念を挂く回：[{meta, lec}] */
function rxRelatedLectures(concepts){
  const out=[];
  rxOthers().forEach(function(o){
    o.ix.lectures.forEach(function(Lc){
      const p=(Lc.props||[]).find(function(p){ return (p.concepts||[]).some(function(g){ return concepts.indexOf(g)>=0; }); });
      if(p) out.push({meta:o.meta,lec:Lc,prop:p.id,card:RX.firstCardOf(o.ix,p.id)});
    });
  });
  return out;
}
function rxRefreshLinks(){
  document.querySelectorAll('#view .rx-card').forEach(function(a){
    const e=App.rx.ix.cards[a.id.replace(/^rxc-/,'')], bd=a.querySelector('.rx-card-bd'); if(!e || !bd) return;
    const old=bd.querySelector('.rx-links'), nu=rxCardLinks(e.card);
    if(old) old.remove(); if(nu) bd.appendChild(nu);
  });
}
function rxGoOther(meta,lecId,cardId,propId,srcLec){ // 別の課の回へ：関連カードに着地し、戻るで元の課・元の位置へ（U-10）
  const src={meta:App.course,lec:srcLec,y:window.scrollY};
  enterCourse(meta,function(){
    if(srcLec) viewStack=[{key:'xback',noRestore:true,xname:(src.meta.title&&src.meta.title.ja)||L(src.meta.title),render:function(){ rxReturnTo(src); }}];
    renderRxLecture(lecId);
    if(cardId) rxGoCard(cardId,propId);
  });
}
function rxReturnTo(src){ enterCourse(src.meta,function(){ baseHome(); renderRxLecture(src.lec); requestAnimationFrame(function(){ window.scrollTo(0,src.y); }); }); }
function rxCardLinks(c){
  const gs=rxConceptsOfCard(c); if(!gs.length) return null;
  const kids=[];
  const rel=rxRelatedLectures(gs);
  if(rel.length) kids.push(el('div',{class:'rx-rel'},[ el('span',{class:'rx-rel-lb jp',text:t('rxRelated')}) ].concat(rel.map(function(r){
    return el('button',{class:'rx-chip jp',text:L(r.meta.title)+'・'+t('rxKaiN').replace('{n}',r.lec.kai),onclick:function(){ const ce=App.rx.ix.cards[c.id]; rxGoOther(r.meta,r.lec.id,r.card,r.prop,ce?ce.lec:null); }}); }))));
  const named=gs.filter(rxConceptLabel).slice(0,6);
  if(named.length) kids.push(el('div',{class:'rx-rel'},[ el('span',{class:'rx-rel-lb jp',text:t('rxConcepts')}) ].concat(named.map(function(g){
    return el('button',{class:'rx-chip jp',text:rxConceptLabel(g),onclick:function(){ renderRxConcept(g); }}); }))));
  return kids.length?el('div',{class:'rx-links'},kids):null;
}
/* 概念页：本课与其他新课里挂这个概念的命题与卡片；旧课映射（单向） */
function renderRxConcept(slug){
  registerFrame(function(){ renderRxConcept(slug); },'rx-concept:'+slug);
  const kids=[ sectionHead(t('rxConcepts'),goBack), el('h1',{class:'rx-h jp',text:rxConceptLabel(slug)||''}) ]; // 見出し＝この画面の種類（「戻る 戻る」にしない：U-31）
  const sources=[{meta:App.course,ix:App.rx.ix,content:App.rx.content,here:true}].concat(rxOthers().map(function(o){ return {meta:o.meta,ix:o.ix,content:o.content,here:false}; }));
  sources.forEach(function(src){
    const rows=[];
    src.ix.lectures.forEach(function(Lc){
      (Lc.props||[]).forEach(function(p){
        if((p.concepts||[]).indexOf(slug)<0) return;
        const card=RX.firstCardOf(src.ix,p.id);
        rows.push(el('div',{class:'rx-gap'},[
          el('div',{class:'rx-prop'},[ el('span',{class:'rx-stars','aria-hidden':'true',text:rxStars(p.imp)}), el('span',{class:'rx-pt jp',text:p.text}) ]),
          el('button',{class:'rx-tri-go jp',text:t('rxKaiN').replace('{n}',Lc.kai)+'　'+(Lc.title||''),onclick:function(){
            if(!src.here) rxGoOther(src.meta,Lc.id,card); else if(card) rxGoCard(card,p.id); else renderRxLecture(Lc.id); }}) ]));
      });
    });
    if(rows.length){ kids.push(el('h2',{class:'rx-bh jp',text:L(src.meta.title)})); rows.forEach(function(r){ kids.push(r); }); }
  });
  const lm=App.rx.content.legacy, legacy=(lm && typeof lm==='object' && lm[slug] && typeof lm[slug]==='object')?lm[slug]:{};
  Object.keys(legacy).forEach(function(oid){
    const meta=courseList().filter(function(c){ return c.id===oid && c.contract!==RX.CONTRACT; })[0]; if(!meta || typeof legacy[oid]!=='string') return;
    kids.push(el('h2',{class:'rx-bh jp',text:L(meta.title)}));
    kids.push(el('button',{class:'rx-tri-go jp',text:legacy[oid],onclick:function(){ enterCourse(meta,function(){ renderConcept(legacy[oid]); }); }}));
  });
  setView(el('div',{class:'rx-lecture'},kids));
}

/* ---------- 答法规则：課ページに一度だけ全文、回の先頭から一行の短链（内容形式 v3 定稿・Q-032 A）。形＝数据规格 §2.2 answer_rules・§2.4 answer_preamble。
 * 桥接期は配布に出ない（キーが無い＝入口も短链も出さない）。形の崩れた項目は黙って飛ばす（表示側の降級）。データの文字は日本語：中文界面でも lang=ja。 */
const RX_APPLIES=['期末','国試'], RX_APPLIES_KEY={'期末':'rxRulesFinal','国試':'rxRulesKokushi'}; // 組の順と見出し。知らない値は原値のまま後ろに
function rxStr(v){ return typeof v==='string' && v.trim()?v:null; }
function rxRules(){ const c=App.rx&&App.rx.course, a=c&&Array.isArray(c.answer_rules)?c.answer_rules:[];
  return a.filter(function(r){ return r && typeof r==='object' && rxStr(r.short) && rxStr(r.text); }); }
function rxRulesLink(cls){ return rxRules().length?el('button',{class:cls+' jp',onclick:function(){ renderRxRules(); }},[ el('span',{class:'rx-rules-l',text:t('rxRulesH')}), el('span',{class:'rx-rules-a','aria-hidden':'true',text:'›'}) ]):null; }
function rxRulesPre(pre){ // 前言：優先順位（有序列表・括弧の中の順は文字のまま）→ 注（items は子の列表）→ 標準の一行
  const box=el('section',{class:'rx-rule-pre'}), od=(pre.order&&typeof pre.order==='object')?pre.order:{};
  const steps=(Array.isArray(od.steps)?od.steps:[]).filter(rxStr);
  if(rxStr(od.label)) box.appendChild(el('h2',{class:'rx-bh jp',lang:'ja',text:od.label}));
  if(steps.length) box.appendChild(el('ol',{class:'rx-rule-order jp',lang:'ja'},steps.map(function(s){ return el('li',{text:s}); })));
  const notes=(Array.isArray(pre.notes)?pre.notes:[]).filter(function(n){ return n && typeof n==='object' && rxStr(n.text); });
  if(notes.length) box.appendChild(el('ul',{class:'rx-rule-notes jp',lang:'ja'},notes.map(function(n){
    const items=(Array.isArray(n.items)?n.items:[]).filter(rxStr);
    return el('li',null,[ n.text, items.length?el('ul',null,items.map(function(x){ return el('li',{text:x}); })):null ]); })));
  const sd=pre.standard; if(sd && typeof sd==='object' && rxStr(sd.label) && rxStr(sd.text)) box.appendChild(el('p',{class:'rx-rule-std jp',lang:'ja'},[ el('b',{text:sd.label}), '：'+sd.text ]));
  return box.childNodes.length?box:null;
}
function renderRxRules(focus){
  const rules=rxRules(); if(!rules.length){ goHome(); return; }
  registerFrame(function(){ renderRxRules(); },'rx-rules');
  const pre=App.rx.course.answer_preamble, hasPre=!!(pre && typeof pre==='object' && !Array.isArray(pre));
  const kids=[ sectionHead('',goBack), el('h1',{class:'rx-h jp',text:t('rxRulesH')}) ];
  const pb=hasPre?rxRulesPre(pre):null; if(pb) kids.push(pb);
  const keys=[], by={};
  rules.forEach(function(r){ const k=rxStr(r.applies)||''; if(!by[k]){ by[k]=[]; keys.push(k); } by[k].push(r); });
  keys.sort(function(a,b){ const ia=RX_APPLIES.indexOf(a), ib=RX_APPLIES.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); }); // 安定：知らない値は出た順
  keys.forEach(function(k){
    const g=el('section',{class:'rx-rule-g'},[ RX_APPLIES_KEY[k]?el('h2',{class:'rx-bh jp',text:t(RX_APPLIES_KEY[k])}):(k?el('h2',{class:'rx-bh jp',lang:'ja',text:k}):null) ]);
    by[k].forEach(function(r){ g.appendChild(el('div',{class:'rx-rule','data-rule':rxStr(r.id)||''},[ el('h3',{class:'rx-rule-h jp',lang:'ja',text:r.short}), el('p',{class:'rx-rule-t jp',lang:'ja',text:r.text}) ])); });
    kids.push(g);
  });
  const cn=hasPre&&rxStr(pre.course_notes_label)?(Array.isArray(pre.course_notes)?pre.course_notes:[]).filter(function(n){ return n && typeof n==='object' && rxStr(n.text); }):[];
  if(cn.length) kids.push(el('section',{class:'rx-rule-cn'},[ el('h2',{class:'rx-bh jp',lang:'ja',text:pre.course_notes_label}), el('ul',{class:'rx-rule-notes jp',lang:'ja'},cn.map(function(n){ return el('li',{text:n.text}); })) ]));
  setView(el('div',{class:'rx-lecture rx-rules'},kids)); document.body.classList.add('rx-wide');
  if(focus){ const n=[].slice.call(document.querySelectorAll('.rx-rules .rx-rule')).filter(function(x){ return x.getAttribute('data-rule')===focus; })[0]; if(n) n.scrollIntoView({block:'start'}); } // 比較の短句から一条へ（後で繋ぐ）
}
