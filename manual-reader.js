'use strict';
/* ---------- CONCEPT page (shared: manual / weakness / runner) ---------- */
/* ---------- shared node builders (used by manual two-column AND standalone pages) ---------- */
function conceptCardNode(name,onQ){
  const meta=App.idx.conceptMeta[name];
  const qids=App.idx.conceptToQuestions[name]||[];
  const card=el('div',{class:'card'});
  if(meta&&meta.exists){
    card.appendChild(el('div',{class:'exblock short'},[ el('div',{class:'exhd',text:t('explain')}), richExplain(L(meta.definition)) ]));
    card.appendChild(el('div',{class:'crumb',style:'margin-top:8px'},[ el('span',{class:'jp2',text:t('origin')}), el('span',{class:'sep',text:'›'}),
      el('b',{text:'回'+meta.origin.kai}), el('span',{class:'jp2',text:meta.origin.section||''}) ]));
  } else {
    card.appendChild(el('p',{class:'muted jp',text:t('conceptMissing')}));
  }
  card.appendChild(el('div',{class:'rubt jp',style:'margin-top:14px',text:t('related')+'（'+qids.length+'）'}));
  qids.slice(0,80).forEach(function(id){
    const q=App.idx.byId[id];
    const row=el('button',{class:'listrow'},[ el('span',{class:'lead',text:id}),
      el('span',{class:'main jp'},[ document.createTextNode(typeLabel(q.type)+' · '+q.kind), el('small',{text:q.q}) ]) ]);
    row.addEventListener('click',function(){ onQ(id); });
    card.appendChild(row);
  });
  if(qids.length) card.appendChild(el('button',{class:'btn',style:'margin-top:12px',text:App.lang==='ja'?'この概念の問題を解く':'刷该概念的题',onclick:function(){
    const list=C.reviewSample(App.questions,{onlyIds:qids,count:Math.min(qids.length,20),recentIds:App.recent},App.rng);
    newSession('review',list,{}); renderRunner();
  }}));
  return card;
}
function readingCardNode(id){
  const q=App.idx.byId[id];
  const card=el('div',{class:'card'});
  if(isQuarantined(id)){
    card.appendChild(el('div',{class:'tags'},[ el('span',{class:'tag kind',text:q.kind}), el('span',{class:'tag',text:'回'+q.kai}) ]));
    card.appendChild(qtextNode(q.q));
    card.appendChild(el('p',{class:'muted jp',style:'margin-top:12px',text:t('quarantined')}));
    return card;
  }
  card.appendChild(el('div',{class:'tags'},[ el('span',{class:'tag kind',text:q.kind}), q.topic?el('span',{class:'tag',text:q.topic}):null, el('span',{class:'tag',text:'回'+q.kai}) ]));
  card.appendChild(qtextNode(q.q));
  if(q.type==='choice'){
    const ow=el('div',{class:'opts'});
    q.options.forEach(function(o){ const b=el('div',{class:'opt jp'+(o.correct?' ok':'')},[ el('span',{class:'mk',text:o.correct?'✓':''}), el('span',{text:o.t}) ]); if(o.correct) b.appendChild(el('span',{class:'lbl',text:t('correct')})); ow.appendChild(b); });
    card.appendChild(ow);
  } else {
    card.appendChild(el('div',{class:'exblock model',style:'margin-top:12px'},[ el('div',{class:'exhd',text:t('model')}), richExplain(L(q.modelAnswer), qTerms(q)) ]));
    const rb=el('div',{style:'margin-top:10px'}); rb.appendChild(el('div',{class:'rubt jp',text:t('rubricHint').split('（')[0]}));
    q.rubric.forEach(function(r){ rb.appendChild(el('div',{class:'rb',style:'cursor:default'},[ el('span',{class:'ck'}), el('div',null,[ el('div',{class:'rt jp',text:L(r.point)}), el('span',{class:'rc',text:r.concept}) ]) ])); });
    card.appendChild(rb);
  }
  card.appendChild(buildReadingReveal(q));
  return card;
}
function manualListNode(kind,key,onItem){
  const ids = kind==='kai'?App.idx.kaiToQuestions[key]:App.idx.topicToQuestions[key];
  const card=el('div',{class:'card'});
  (ids||[]).forEach(function(id){
    const q=App.idx.byId[id];
    const row=el('button',{class:'listrow'},[ el('span',{class:'lead',text:id}),
      el('span',{class:'main jp'},[ document.createTextNode(typeLabel(q.type)+' · '+q.kind), el('small',{text:q.q}) ]) ]);
    row.addEventListener('click',function(){ onItem(id); });
    card.appendChild(row);
  });
  return card;
}

/* ---------- CONCEPT page (standalone: from weakness / result / runner trail / home glance) ---------- */
function renderConcept(name,ctx){
  registerFrame(function(){ renderConcept(name,ctx); },'concept:'+name);
  setView(el('div',null,[ sectionHead(name),
    conceptCardNode(name, function(id){ renderReading(id,{from:'concept',name:name,ctx:ctx}); }) ]));
}

/* ---------- READING page (standalone: a concept's related question opened from a standalone concept page) ---------- */
function renderReading(id,ctx){
  registerFrame(function(){ renderReading(id,ctx); },'reading:'+id);
  setView(el('div',null,[ sectionHead(id), readingCardNode(id) ]));
}

/* ---------- MANUAL (手册): two-column master / detail; degrades to paged on narrow ---------- */
/* ---------- 資料集リーダー (一節一ページ, manual.json 駆動) ---------- */
let readerDir='none'; // ページ送り方向(演出): 'fwd' 次へ / 'back' 前へ / 'none' 直接
function openReader(kai){ renderReader(kai,0); }
function readerBackLabel(){ // 「‹ 」の後ろ: 実際の戻り先(前フレーム)に合わせて可変 →「資料集」固定表示が home/bookmarks へ飛ぶ誤りを解消
  const prev=(viewStack.length>1)?viewStack[viewStack.length-2].key:null;
  if(prev==='readerIndex') return t('modeManual'); // 資料集
  if(prev==='bookmarks') return t('actBook');       // ブックマーク
  if(prev==='home'||!prev) return t('home');        // ホーム
  return t('back');                                  // 戻る(concept 等)
}
function renderReaderIndex(){ // 資料集ホーム: 回一覧(赤框CTAの行き先)
  registerFrame(renderReaderIndex,'readerIndex');
  const ja=App.lang==='ja';
  const units=(App.manual&&App.manual.units)?App.manual.units.slice().sort(function(a,b){return a.kai-b.kai;}):[];
  const list=el('div',{class:'ridx'});
  units.forEach(function(u){
    const n=(u.sections||[]).length, q=(u.sections||[]).reduce(function(a,s){return a+practiceCount(s);},0);
    list.appendChild(el('button',{class:'ridx-row',onclick:(function(k){return function(){ renderReader(k,0); };})(u.kai)},[
      el('span',{class:'ridx-kai',text:'第'+u.kai+'回'}),
      el('span',{class:'ridx-tx'},[ el('b',{class:'jp',text:u.title}), el('small',{class:'jp',text:n+(ja?'節 · 演習':'节 · 演习')+q+(ja?'問':'题')}) ]),
      el('span',{class:'ridx-ch',text:'›'})
    ]));
  });
  setView(el('div',null,[ sectionHead(t('modeManual')), list ]), true);
}
function renderReader(kai,sec){
  const unit=(App.manual&&App.manual.units)?App.manual.units.find(function(u){return u.kai===kai;}):null;
  if(!unit){ return renderManual(); }
  const secs=unit.sections||[]; const pageCount=secs.length+1;
  sec=Math.max(0,Math.min(sec||0,pageCount-1)); App.reader={kai:kai,sec:sec};
  if(App.course) lsSet(nk('lastRead'),{kai:kai,sec:sec}); // 続読用に最終位置を保存
  registerFrame(function(){ renderReader(App.reader.kai,App.reader.sec); },'reader');
  document.documentElement.style.setProperty('--rdr-fs', String(parseFloat(lsGet(nk('readerFs'),1))||1)); // 保存済み字号を復元
  const ja=App.lang==='ja';
  const pageLabel=(sec===0)?(ja?'はじめに':'开篇'):secs[sec-1].sectionId;
  const bm='<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-deep)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>';
  const hd=el('div',{class:'rdr-hd'},[ el('div',{class:'rdr-crumb'},[
    el('button',{class:'rdr-back',text:'‹ '+readerBackLabel(),onclick:function(){ leaveReader(); if(viewStack.length>1) goBack(); else { App.homeTab='review'; goHome(); } }}),
    el('span',{class:'rdr-kai',text:'第'+kai+'回'}),
    el('span',{class:'rdr-pg',text:pageLabel+' · '+(sec+1)+'/'+pageCount}),
    el('div',{class:'rdr-tools'},[
      el('div',{class:'rdr-fs-wrap'},[
        el('button',{class:'rdr-aa',html:'A<span style="font-size:15px">a</span>',title:ja?'文字サイズ':'字号',onclick:toggleFontPop}),
        el('div',{class:'rdr-fs-pop'},[
          el('span',{class:'rdr-fs-mini',text:'A'}),
          el('input',{type:'range',class:'rdr-fs-range','aria-label':(App.lang==='ja'?'文字サイズ':'字号'),min:'0.85',max:'1.3',step:'0.01',value:String(curReaderFont()),oninput:function(e){ setReaderFont(e.target.value); }}),  /* B2: 読み上げに名前が無かった */
          el('span',{class:'rdr-fs-big',text:'A'})
        ])
      ]),
      el('button',{class:'rdr-bm'+(isReaderBookmarked(kai,sec)?' on':''),html:bm,'aria-label':ja?'ブックマーク':'书签','aria-pressed':String(isReaderBookmarked(kai,sec)),onclick:function(e){ toggleReaderBookmark(kai,sec,e.currentTarget); }})
    ])
  ]) ]);
  function tocList(chip){
    const box=el('div',{class:chip?'rdr-chips':'rdr-toc'});
    if(!chip) box.appendChild(el('div',{class:'tl',text:ja?'目次':'目录'}));
    const add=function(idx,short,title){
      if(chip){ box.appendChild(el('button',{class:idx===sec?'on':'',text:short,onclick:function(){ gotoReader(idx); }})); }
      else { box.appendChild(el('button',{class:'ti'+(idx===sec?' on':''),onclick:function(){ gotoReader(idx); }},[ el('span',{class:'sn',text:short}), el('span',{class:'st jp',text:title}) ])); }
    };
    add(0, ja?'扉':'扉', ja?'はじめに':'开篇');
    secs.forEach(function(s,i){ add(i+1,s.sectionId,s.title); });
    return box;
  }
  const main=el('main',{class:'rdr-main'},[ tocList(true) ]);
  const art=el('article',null,[ sec===0?readerCover(unit,secs):readerSection(secs[sec-1]) ]);
  const reduceR=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(readerDir!=='none' && !reduceR) art.className='rdr-in-'+readerDir; // ページ送りの方向性入場(動効表: --curve, 局部内容)
  readerDir='none';
  main.appendChild(art);
  main.appendChild(readerPager(sec,pageCount));
  setView(el('div',{class:'rdr'},[ hd, el('div',{class:'rdr-row'},[ tocList(false), main ]) ]));
  document.body.classList.add('reader-view'); window.scrollTo(0,0);
}
function gotoReader(idx){ const cur=App.reader?App.reader.sec:0; readerDir=(idx>cur)?'fwd':(idx<cur?'back':'none'); renderReader(App.reader.kai,idx); }
function leaveReader(){ document.body.classList.remove('reader-view'); App.reader=null; }
function curReaderFont(){ const v=parseFloat(document.documentElement.style.getPropertyValue('--rdr-fs')); return v||parseFloat(lsGet(nk('readerFs'),1))||1; }
function setReaderFont(v){ v=Math.max(0.85,Math.min(1.3,parseFloat(v)||1)); document.documentElement.style.setProperty('--rdr-fs',String(v)); if(App.course) lsSet(nk('readerFs'),v); }
function toggleFontPop(e){ e.currentTarget.parentNode.classList.toggle('open'); } // Aa → 滑轨ポップを開閉
function isReaderBookmarked(kai,sec){ return (lsGet(nk('readerBm'),[])||[]).indexOf(kai+':'+sec)>=0; }
function toggleReaderBookmark(kai,sec,btn){ const k=kai+':'+sec; let a=lsGet(nk('readerBm'),[])||[]; const i=a.indexOf(k); if(i>=0){ a.splice(i,1); } else { a.push(k); } lsSet(nk('readerBm'),a); if(btn){ btn.classList.toggle('on', i<0); btn.setAttribute('aria-pressed', String(i<0)); } const ja=App.lang==='ja'; toast(i>=0?(ja?'ブックマークを外しました':'已取消书签'):(ja?'ブックマークに追加しました':'已加入书签')); }
function readerKaiList(){ return (App.manual&&App.manual.units)?App.manual.units.map(function(u){return u.kai;}).sort(function(a,b){return a-b;}):[]; }
function adjacentKai(kai,dir){ const ks=readerKaiList(), i=ks.indexOf(kai); if(i<0) return null; const t=ks[i+dir]; return (t==null)?null:t; } // dir=+1 次の回 / -1 前の回
function readerPageCount(kai){ const u=(App.manual&&App.manual.units)?App.manual.units.find(function(x){return x.kai===kai;}):null; return u?((u.sections||[]).length+1):1; }
function readerPager(sec,total){
  const ja=App.lang==='ja', dots=el('div',{class:'rdr-dots'});
  for(let i=0;i<total;i++){ // F11: マウス専用 <i> → 名前付き button (キーボード/読み上げで直接跳べる); 現在頁は aria-current
    const d=el('button',{type:'button',class:i===sec?'on':'','aria-label':t('dotPage').replace('{n}',String(i+1)).replace('{m}',String(total))});
    if(i===sec) d.setAttribute('aria-current','page');
    d.addEventListener('click',function(){ if(i!==sec) gotoReader(i); }); dots.appendChild(d); }
  const kai=App.reader?App.reader.kai:null;
  const prevKai=(kai!=null)?adjacentKai(kai,-1):null, nextKai=(kai!=null)?adjacentKai(kai,1):null;
  let prev; // 前へ: 節内は前節; 章頭(sec0)なら前の回の最終頁へ; 無ければ無効
  if(sec>0){ prev=el('button',{text:'‹ '+(ja?'前へ':'上一页'),onclick:function(){ gotoReader(sec-1); }}); }
  else if(prevKai!=null){ prev=el('button',{class:'rdr-pg-kai',text:'‹ 第'+prevKai+'回',onclick:function(){ readerDir='back'; renderReader(prevKai, readerPageCount(prevKai)-1); }}); }
  else { prev=el('button',{text:'‹ '+(ja?'前へ':'上一页')}); prev.disabled=true; }
  let next; // 次へ: 節内は次節; 最終頁なら次の回の扉へ; 無ければ無効
  if(sec<total-1){ next=el('button',{text:(ja?'次へ':'下一页')+' ›',onclick:function(){ gotoReader(sec+1); }}); }
  else if(nextKai!=null){ next=el('button',{class:'rdr-pg-kai',text:'第'+nextKai+'回 ›',onclick:function(){ readerDir='fwd'; renderReader(nextKai, 0); }}); }
  else { next=el('button',{text:(ja?'次へ':'下一页')+' ›'}); next.disabled=true; }
  return el('div',{class:'rdr-pager'},[ prev, dots, next ]);
}
function practiceCount(sec){ return (sec.blocks||[]).filter(function(b){return b.type==='practice';}).reduce(function(a,b){return a+(b.items||[]).length;},0); }
function firstProse(sec){ const p=(sec.blocks||[]).find(function(b){return b.type==='prose';}); if(!p||!p.text) return ''; const s=p.text.replace(/\s+/g,''); return s.length>26?s.slice(0,26)+'…':s; }
function readerCover(unit,secs){
  const ja=App.lang==='ja', wrap=el('div');
  wrap.appendChild(el('div',{class:'rdr-kick',text:(ja?'まとめノート · 第':'复习手册 · 第')+unit.kai+'回'}));
  wrap.appendChild(el('h1',{class:'rdr-title jp',text:unit.subtitle?(unit.title+' '+unit.subtitle):unit.title}));
  const totalQ=secs.reduce(function(a,s){return a+practiceCount(s);},0);
  wrap.appendChild(el('div',{class:'rdr-meta'},[
    el('b',{text:secs.length+(ja?'節':'节')}), el('span',{class:'dot',text:'·'}),
    el('b',{text:(ja?'演習':'演习')+totalQ+(ja?'問':'题')}), el('span',{class:'dot',text:'·'}),
    el('span',{text:(ja?'出典 ':'出处 ')+(App.course?L(App.course.title):'')+(ja?' 第':' 第')+unit.kai+'回'})  /* v1.7.0: コース名を直書きしていた(2門目で誤帰属) */
  ]));
  if(unit.lede) wrap.appendChild(el('div',{class:'rdr-lede jp'},[ el('span',{class:'pl',text:ja?'はじめに':'开篇'}), document.createTextNode(unit.lede) ]));
  const flow=el('div',{class:'rdr-flow'},[ el('div',{class:'fl',text:ja?'この回の流れ':'本回脉络'}) ]);
  secs.forEach(function(s,i){ const q=practiceCount(s);
    flow.appendChild(el('button',{class:'fr',onclick:function(){ gotoReader(i+1); }},[
      el('span',{class:'id',text:s.sectionId}),
      el('span',{class:'tx'},[ el('b',{class:'jp',text:s.title}), el('small',{class:'jp',text:firstProse(s)}) ]),
      el('span',{class:'cnt',text:q?(q+(ja?'問':'题')):''}), el('span',{class:'ch',text:'›'})
    ]));
  });
  wrap.appendChild(flow);
  return wrap;
}
function readerSection(sec){
  const wrap=el('div',{class:'rdr-sec'},[ el('div',{class:'rdr-sh'},[ el('span',{class:'sn',text:sec.sectionId}), el('h2',{class:'jp',text:sec.title}) ]) ]);
  (sec.blocks||[]).forEach(function(b){ const n=readerBlock(b); if(n) wrap.appendChild(n); });
  return wrap;
}
function readerBlock(b){
  if(b.type==='prose') return el('p',{class:'rdr-p jp',text:b.text||''});
  if(b.type==='figure') return readerFigure(b);
  if(b.type==='callout') return readerCallout(b);
  if(b.type==='crossref') return readerCrossref(b);
  if(b.type==='practice') return readerPractice(b);
  /* --- manual-0.3(神経)の増設ブロック ---
   * 旧 manual は term+def の用語集にすぎず、カードの details・対比表・教員の口頭強調・
   * caveat・図が全部落ちていた。読む/さがす主体のコースではそこが本体なので、
   * データを落とさずに載せられるブロックを足す。 */
  if(b.type==='concept')   return readerConcept(b);
  if(b.type==='compare')   return readerCompare(b);
  if(b.type==='signals')   return readerSignals(b);
  if(b.type==='selfcheck') return readerSelfcheck(b);
  return null;
}
/* 言語つき配列/文字列の取り出し(zh が空なら ja に落とす) */
/* B5: {ja:""} のような「空の双語殻」は中身が無い。オブジェクトの真偽ではなく、
 * 言語解決後の文字列で判断する(空白のみも無しと見なす)。 */
function LT(o){ if(!o) return ''; if(typeof o==='string') return o.trim()?o:'';
  var v=(App.lang==='zh'&&typeof o.zh==='string'&&o.zh.trim())?o.zh:o.ja;
  return (typeof v==='string'&&v.trim())?v:''; }
function LL(o){ if(!o) return []; if(Array.isArray(o)) return o; var v=(App.lang==='zh'&&o.zh&&o.zh.length)?o.zh:o.ja; return v||[]; }

/* 出典: slide は「第N回 pM」、転録は畳んだ ¶ 範囲。旧データは ¶ を 1 枚に最大 64 個
 * 並べており、そのまま chip にすると読めないので範囲表示にしてある。 */
/* 出典は レジュメ のページだけを見せる。どこから採った情報か(スライドか話し言葉か)は
 * 作る側の来歴であって、読む側には意味が無い。ページ番号だけあれば原典に戻れる。 */
function srcChips(b){
  const ja=App.lang==='ja', row=el('div',{class:'rc-src'}), seen={};
  (b.sources||[]).forEach(function(s){
    let pg=null;
    if(s.slide!=null) pg='p'+s.slide;
    else if(s.ocr!=null) pg='p'+s.ocr;
    if(!pg) return;                       /* ページを持たない出典は出さない */
    const txt=(ja?'レジュメ 第':'讲义 第')+s.kai+(ja?'回 ':'回 ')+pg+(s.file?('('+s.file+')'):'');
    if(seen[txt]) return; seen[txt]=1;
    row.appendChild(el('span',{class:'rc-s',text:txt}));
  });
  return row.childNodes.length?row:null;
}
function readerConcept(b){
  const ja=App.lang==='ja';
  const box=el('article',{class:'rc',id:'c-'+(b.cardId||'')});
  const hd=el('div',{class:'rc-hd'},[ el('h3',{class:'rc-term jp',text:b.term}) ]);
  if(b.yomi) hd.appendChild(el('span',{class:'rc-yomi',text:b.yomi}));
  box.appendChild(hd);
  if((b.aliases||[]).length){
    const al=el('div',{class:'rc-alias'});
    b.aliases.slice(0,6).forEach(function(a){ al.appendChild(el('span',{class:'rc-a',text:a})); });
    box.appendChild(al);
  }
  box.appendChild(el('p',{class:'rc-def jp',text:LT(b.def)}));
  const ul=el('ul',{class:'rc-b'});
  LL(b.bullets).forEach(function(x){ ul.appendChild(el('li',{class:'jp',text:x})); });
  box.appendChild(ul);
  if(b.heard && LL(b.heard).length){
    const hl=el('ul',{class:'rc-b rc-heard'});
    LL(b.heard).forEach(function(x){ hl.appendChild(el('li',{class:'jp',text:x})); });
    box.appendChild(el('div',{class:'rc-heardwrap'},[
      el('div',{class:'rc-hl',text:ja?'補足':'补充'}), hl ]));
  }
  if(b.figure) box.appendChild(readerFigure2(b.figure));
  /* 図が AI 作図でも切り出しでも、分からない時はレジュメのそのページに逃げられるようにする。
   * ライブラリへの入口は作らない(各カードからだけ辿れる)。 */
  if(b.refPage) box.appendChild(refPageNode(b.refPage, b.term));
  if(b.signal) box.appendChild(signalNode(b.signal,ja));
  if(b.caveat) box.appendChild(caveatNode(b.caveat,ja));
  if((b.compare||[]).length){
    const cr=el('div',{class:'rc-links'});
    cr.appendChild(el('span',{class:'rc-lk',text:ja?'対比表':'对比表'}));
    b.compare.forEach(function(gid){
      cr.appendChild(el('button',{class:'rxchip',text:compareTitle(gid)||gid,
        onclick:function(){ gotoCompare(gid); }}));
    });
    box.appendChild(cr);
  }
  if((b.related||[]).length){
    const rl=el('div',{class:'rc-links'});
    rl.appendChild(el('span',{class:'rc-lk',text:ja?'関連':'相关'}));
    b.related.forEach(function(r){ rl.appendChild(relChip(r)); });
    box.appendChild(rl);
  }
  const sc=srcChips(b); if(sc) box.appendChild(sc);
  return box;
}
/* 路径A(自産SVG)は本文に inline、路径C(医学図)は「原図を見に行け」の指針。
 * 医学解剖図は生成しない方針なので、白紙にも捏造にもせず、原典への正確なポインタを出す。 */
function readerFigure2(f){
  const ja=App.lang==='ja';
  if(f.kind==='svg'){
    const w=el('figure',{class:'rc-fig'});
    const holder=el('div',{class:'rc-svg'}); holder.innerHTML=f.svg||''; uniquifySvgIds(holder); // F1: 同節複数図の id 衝突で後続図が先頭図の名前を名乗る事故を注入時に断つ
    w.appendChild(holder);
    if(f.caption) w.appendChild(el('figcaption',{class:'jp',text:f.caption}));
    return w;
  }
  /* 解剖図はレジュメの原図をそのまま切り出して載せる(描き起こすと不正確になりうる)。 */
  if(f.kind==='slide'){
    const w=el('figure',{class:'rc-fig rc-fig-slide'});
    /* width/height を必ず入れる。無いと lazy 読み込み中の高さが 0 になり、
     * 画像が届いた瞬間に本文が下へ跳ねる(真机テストで検出)。 */
    const img=el('img',{class:'rc-img',src:(App.course.dir+'/'+f.src),alt:f.alt||'',
      loading:'lazy',decoding:'async',width:(f.w||1000),height:(f.h||600)});
    const zoom=el('button',{class:'rc-zoom',title:ja?'拡大':'放大',onclick:function(){ openFigZoom(f,img.src); }},[
      el('span',{html:NEW_ICONS.search}) ]);
    w.appendChild(el('div',{class:'rc-imgwrap'},[ img, zoom ]));
    w.appendChild(el('figcaption',{class:'jp',
      text:(ja?'レジュメ 第':'讲义 第')+f.kai+(ja?'回 p':'回 p')+f.slide+(f.file?('('+f.file+')'):'')}));
    return w;
  }
  if(f.kind==='slideref'){
    return el('div',{class:'rc-slideref'},[
      el('span',{class:'sr-ic',html:NEW_ICONS.book}),
      el('span',{class:'sr-t jp',text:(ja?'レジュメ 第':'讲义 第')+f.kai+(ja?'回 p':'回 p')+f.slide
        +(f.file?('('+f.file+')'):'')+(ja?' を参照':' 参照')})
    ]);
  }
  return null;
}
/* 描き起こした図で分かりにくい時、レジュメのそのページを開ける出口。カードの中にだけ置く。 */
function refPageNode(rp, term){
  const ja=App.lang==='ja';
  return el('button',{class:'rc-ref jp',
    onclick:function(){ openRefPage(rp, term); }},[
    el('span',{class:'rf-ic',html:NEW_ICONS.book}),
    el('span',{class:'rf-t',text:(ja?'レジュメのこのページを見る（第':'看讲义这一页（第')+rp.kai+(ja?'回 p':'回 p')+rp.slide+'）'}),
    el('span',{class:'rf-a',text:'›'})
  ]);
}
function openRefPage(rp, term){
  const ja=App.lang==='ja';
  const img=el('img',{class:'fz-img',src:(App.course.dir+'/'+rp.src),
    alt:(term||'')+(ja?' のレジュメのページ':' 的讲义页面'),
    width:(rp.w||1100), height:(rp.h||800), decoding:'async'});
  const body=el('div',{class:'fz-wrap'},[ img,
    el('div',{class:'fz-cap jp',text:(ja?'レジュメ 第':'讲义 第')+rp.kai+(ja?'回 p':'回 p')+rp.slide}) ]);
  openModal(modalShell(term||(ja?'レジュメのページ':'讲义页面'), [ body ]));
}

/* 図の拡大(解剖図は細部が要るので、原寸で見られる逃げ道を用意する) */
function openFigZoom(f,src){
  const ja=App.lang==='ja';
  const body=el('div',{class:'fz-wrap'},[
    el('img',{class:'fz-img',src:src,alt:f.alt||''}),
    el('div',{class:'fz-cap jp',text:(ja?'レジュメ 第':'讲义 第')+f.kai+(ja?'回 p':'回 p')+f.slide})
  ]);
  openModal(modalShell(f.alt||(ja?'図':'图'),[ body ]));
}
/* 教員シグナルの出典は 2 種類ある:口頭(転録の ¶)と、スライドに書かれた復習設問(p)。
 * 後者(4件)は「脳波の種類とその特徴について述べよ」のような、事実上の予告問題。
 * 一律に ¶ を付けると「¶undefined」になる。 */
/* 出典は レジュメ にページがある時だけ。話し言葉由来のものは出典を伏せる(表に出す意味が無い)。 */
function sigSrcText(src){
  if(!src||src.kai==null||src.slide==null) return '';
  return 'レジュメ 第'+src.kai+'回'+(src.file?('('+src.file+')'):'')+' p'+src.slide;
}
function signalNode(sg,ja){
  return el('blockquote',{class:'rc-sig'},[
    el('span',{class:'sg-l',text:ja?'授業で強調':'课上强调'}),
    el('p',{class:'jp',text:'「'+(sg.quote||'')+'」'}),
    el('span',{class:'sg-s',text:sigSrcText(sg.src)})
  ]);
}
/* caveat は「教材の字面 vs 定説」。正解を先に、教材の記載は消さずに残す(简报 §3)。
 * 4件しかないが、そのどれもが試験で直接損をする論点なので、専用の見た目にする。 */
function caveatNode(cv,ja){
  const box=el('div',{class:'rc-cav'});
  box.appendChild(el('div',{class:'cv-hd'},[
    el('span',{class:'cv-ic',text:'!'}),
    el('b',{class:'jp',text:ja?'レジュメの記述に注意':'讲义记述有问题'})
  ]));
  const zh=cv.zh||{};
  const row=function(lab,val,cls){ if(!val) return null;
    return el('div',{class:'cv-r '+cls},[ el('span',{class:'cv-l',text:lab}), el('p',{class:'jp',text:val}) ]); };
  const r1=row(ja?'定説':'定论',(App.lang==='zh'&&zh.correct)?zh.correct:cv.correct,'ok');
  const r2=row(ja?'レジュメの説明':'讲义的说法',(App.lang==='zh'&&zh.course)?zh.course:cv.course,'no');
  const r3=row(ja?'試験での判断':'考试时怎么答',(App.lang==='zh'&&zh.exam_hint)?zh.exam_hint:cv.exam,'ex');
  [r1,r2,r3].forEach(function(r){ if(r) box.appendChild(r); });
  return box;
}
/* 対比表: 31 組すべて軸が組ごとに違う。共通軸に揃えようとすると壊れるので、
 * 1 組 = 独立した表として出す(横スクロール可)。 */
function readerCompare(b){
  const box=el('div',{class:'rc-cmp',id:'g-'+(b.id||'')});
  box.appendChild(el('div',{class:'cm-h'},[
    el('b',{class:'jp',text:b.title}),
    el('span',{class:'cm-k',text:(b.kai||[]).map(function(k){return '第'+k+'回';}).join('・')})
  ]));
  const sc=el('div',{class:'cm-scroll'});
  const tb=el('table',{class:'cm-t'});
  const hr=el('tr'); hr.appendChild(el('th',{class:'cm-c0',text:''}));
  (b.axis||[]).forEach(function(a){ hr.appendChild(el('th',{class:'jp',text:a})); });
  tb.appendChild(hr);
  (b.members||[]).forEach(function(m){
    const tr=el('tr');
    const th=el('th',{class:'cm-c0 jp'});
    if(m.cardId){ th.appendChild(el('button',{class:'cm-lk jp',text:m.term,onclick:function(){ gotoCard(m.cardId,m.term); }})); }
    else { th.appendChild(el('span',{class:'jp',text:m.term})); }
    tr.appendChild(th);
    (m.cells||[]).forEach(function(c){ tr.appendChild(el('td',{class:'jp',text:c})); });
    tb.appendChild(tr);
  });
  sc.appendChild(tb); box.appendChild(sc);
  return box;
}
function readerSignals(b){
  const ja=App.lang==='ja';
  const box=el('div',{class:'rc-sigs'});
  box.appendChild(el('div',{class:'sgs-h'},[ el('b',{class:'jp',text:b.title}),
    el('span',{class:'sgs-c',text:(b.items||[]).length+(ja?'件':'条')}) ]));
  (b.items||[]).forEach(function(it){
    box.appendChild(el('button',{class:'sgs-i',onclick:function(){ gotoCard(it.cardId,it.term); }},[
      el('span',{class:'sgs-q jp',text:'「'+it.quote+'」'}),
      el('span',{class:'sgs-t jp',text:it.term+' ›'})
    ]));
  });
  return box;
}
/* 教員が口頭で出した問い(「脳波の種類とその特徴について述べよ」等)は、
 * 配られた問題とは別に、授業で問いの形で示されたもの。自己チェックとして最後に置く。 */
function readerSelfcheck(b){
  const ja=App.lang==='ja';
  const box=el('div',{class:'rc-self'});
  box.appendChild(el('div',{class:'sf-h jp',text:b.title||''}));
  (b.items||[]).forEach(function(it){
    box.appendChild(el('button',{class:'sf-i',onclick:function(){ gotoCard(it.cardId,it.term); }},[
      el('span',{class:'sf-q jp',text:it.quote}),
      el('span',{class:'sf-a jp',text:ja?('→ '+it.term+' を見る'):('→ 看 '+it.term)})
    ]));
  });
  return box;
}
/* 関連語 chip:回を跨ぐので manual 全体から居場所を引く(見つからなければ概念頁へ) */
function relChip(term){
  return el('button',{class:'rxchip',title:term,onclick:function(){ gotoCard(null,term); }},[ document.createTextNode(term) ]);
}
/* --- manual-0.3 のための位置解決(検索・対比表・関連からのジャンプ先) --- */
function manualUnits(){ return (App.manual&&App.manual.units)||[]; }
function compareTitle(gid){
  let t=null;
  manualUnits().some(function(u){ return (u.sections||[]).some(function(s){
    return (s.blocks||[]).some(function(b){ if(b.type==='compare'&&b.id===gid){ t=b.title; return true; } return false; }); }); });
  return t;
}
/* 概念名 or cardId から「どの回のどの節にあるか」を出す。ここが無いと検索から本文へ跳べない。 */
function locateInManual(name,cardId){
  let hit=null;
  manualUnits().some(function(u){
    const secs=u.sections||[];
    return secs.some(function(s,i){
      return (s.blocks||[]).some(function(b){
        if(b.type==='concept' && ((cardId&&b.cardId===cardId) || (!cardId&&b.term===name))){
          hit={kai:u.kai, sec:i+1, anchor:'c-'+b.cardId}; return true;
        }
        if(b.type==='callout' && b.variant==='用語' && Array.isArray(b.items)
           && b.items.some(function(it){ return it.term===name; })){
          hit={kai:u.kai, sec:i+1, anchor:null}; return true;
        }
        return false;
      });
    });
  });
  return hit;
}
function locateCompare(gid){
  let hit=null;
  manualUnits().some(function(u){
    return (u.sections||[]).some(function(s,i){
      return (s.blocks||[]).some(function(b){
        if(b.type==='compare'&&b.id===gid){ hit={kai:u.kai, sec:i+1, anchor:'g-'+gid}; return true; }
        return false; }); }); });
  return hit;
}
function scrollToAnchor(id){
  if(!id) return;
  setTimeout(function(){
    const n=document.getElementById(id);
    if(n){ n.scrollIntoView({block:'center',behavior:'auto'}); n.classList.add('rc-flash'); setTimeout(function(){ n.classList.remove('rc-flash'); },1400); }
  },30);
}
function gotoCard(cardId,term){
  const h=locateInManual(term,cardId);
  if(!h){ if(term) renderConcept(term,{from:'reader'}); return; }
  readerDir='fwd'; renderReader(h.kai,h.sec); scrollToAnchor(h.anchor);
}
function gotoCompare(gid){
  const h=locateCompare(gid); if(!h) return;
  readerDir='fwd'; renderReader(h.kai,h.sec); scrollToAnchor(h.anchor);
}
const XREF_ARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
function conceptReaderSec(kai,concept){ // 該 concept を用語定義する節の reader sec(扉=0/節i=i+1); 無ければ -1
  const u=(App.manual&&App.manual.units)?App.manual.units.find(function(x){return x.kai===kai;}):null; if(!u) return -1;
  const secs=u.sections||[];
  for(let i=0;i<secs.length;i++){ if((secs[i].blocks||[]).some(function(b){
      if(b.type==='callout'&&b.variant==='用語') return (b.items||[]).some(function(it){return it.term===concept;});
      if(b.type==='concept') return b.term===concept;   /* manual-0.3 */
      return false; })) return i+1; }
  return -1;
}
function xchip(kai,concept,label){
  const a=el('button',{class:'rxchip',title:concept,onclick:function(){ const sec=conceptReaderSec(kai,concept); if(sec>=0){ readerDir='fwd'; renderReader(kai,sec); return; } const m=App.idx.conceptMeta[concept]; if(m&&m.exists){ renderConcept(concept,{from:'reader'}); } }, // crossref → 該概念を教える資料集の節へ(問題主体の概念ページでなく); 未マップ時のみ概念ページに fallback
    html:XREF_ARROW},[ document.createTextNode('第'+kai+'回 · '+concept) ]);
  if(label) a.appendChild(el('span',{class:'lb',text:label}));
  return a;
}
const CO_META={
  '用語':{cls:'rco-yougo',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2M9 20h6M12 4v16"/></svg>'},
  '事例':{cls:'rco-jirei',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10h8M8 14h5"/><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.3A8 8 0 1 1 21 12z"/></svg>'},
  '注意':{cls:'rco-chuui',icon:''}, '要点':{cls:'rco-youten',icon:''}
};
function readerCallout(b){
  const m=CO_META[b.variant]||CO_META['用語'];
  const box=el('div',{class:'rco '+m.cls},[ el('span',{class:'pl',html:(m.icon||'')+b.variant}) ]);
  if(b.variant==='用語' && Array.isArray(b.items)){
    b.items.forEach(function(it){ box.appendChild(el('div',{class:'it'},[ el('div',{class:'term jp',text:it.term}), el('div',{class:'def jp',text:it.def}) ])); });
  } else {
    box.appendChild(el('p',{class:'tx jp',text:b.text||''}));
    if(Array.isArray(b.xref)&&b.xref.length){ const xr=el('div',{class:'rxref',style:'margin:10px 0 0'}); b.xref.forEach(function(x){ xr.appendChild(xchip(x.kai,x.concept,x.label)); }); box.appendChild(xr); }
  }
  return box;
}
function readerCrossref(b){ return el('div',{class:'rxref'},[ document.createTextNode(b.label||''), xchip(b.kai,b.concept,b.tag) ]); }
function readerPractice(b){
  const ja=App.lang==='ja', ids=(b.items||[]).map(function(it){return it.qid;});
  const idsRow=el('div',{class:'rprac-ids'});
  ids.slice(0,3).forEach(function(q){ idsRow.appendChild(el('span',{class:'qid',text:q})); });
  if(ids.length>3) idsRow.appendChild(el('span',{class:'qid more',text:'+'+(ids.length-3)}));
  return el('div',{class:'rprac'},[
    el('span',{class:'ric',html:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'}),
    el('div',{class:'rprac-h'},[ el('span',{class:'sub jp',text:b.title||(ja?'演習（知識から事例へ）':'演习（从知识到案例）')}), el('span',{class:'cnt jp',text:((App.course&&App.course.shape==='reader')
      ? (ja?'この回で出された問題・':'这一回出的题・')
      : (ja?'この節の問題を解いてみる・':'做做本节的题・'))+ids.length+(ja?'問':'题')}) ]),
    idsRow,
    /* 神経(読む/さがす型)は臨床の「出題→採点」フローを使わない。答えと解説が開いた一覧へ渡す。 */
    (App.course&&App.course.shape==='reader')
      ? el('button',{class:'rprac-cta jp','aria-label':(ja?'この問題を見る':'看这道题'),
          html:(ja?'答えと解説を見る':'看答案与解说')+' ›',
          onclick:function(){ renderQuestionList(ids[0]); }})
      : el('button',{class:'rprac-cta jp','aria-label':(ja?'この節を演習する':'练习本节'),html:(ja?'この節を演習する':'练习本节')+' ›',onclick:function(){ startPracticeIds(ids); }})
  ]);
}
function startPracticeIds(ids){ const list=ids.map(function(id){ return App.idx.byId[id]; }).filter(Boolean); if(!list.length) return;
  const back=App.reader?{kai:App.reader.kai,sec:App.reader.sec}:null;
  /* 模擬試験の最中は、その問題が隔離されて newSession が null を返す(トーストで通知済み)。
   * 旧実装は戻り値を見ずに renderRunner() を呼んでいた。セッションが無いまま runner を描く経路を断つ。 */
  App.readerReturn=back;
  if(!newSession('review',list,{from:'reader'})){ App.readerReturn=null; return; }
  renderRunner(); }
const FIG_KIND={table:'対照',venn:'ベン',backbone:'背骨',ladder:'階層',cycle:'循環',flow:'フロー'};
function readerFigure(b){
  const fig=el('figure',{class:'rfig'},[ el('figcaption',{class:'rfig-cap'},[ el('span',{class:'tag',text:'図 · '+(FIG_KIND[b.kind]||b.kind)}), el('span',{class:'tt jp',text:b.title||''}) ]) ]);
  const body=figBody(b);
  fig.appendChild(body||el('div',{class:'rfig-ph',text:'['+b.kind+']'}));
  if(b.caption) fig.appendChild(el('div',{class:'rfig-desc jp',text:b.caption}));
  return fig;
}
function figBody(b){ const s=b.spec||{};
  if(b.kind==='table') return figTable(s);
  if(b.kind==='venn') return figVenn(s);
  if(b.kind==='backbone') return figBackbone(s);
  if(b.kind==='flow') return figFlow(s);
  if(b.kind==='ladder') return figLadder(s);
  if(b.kind==='cycle') return figCycle(s);
  return null;
}
function svgEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function figTable(s){
  const cols=(s.columns||[]).length, allRows=[s.columns||[]].concat(s.rows||[]);
  const short=(s.rows||[]).every(function(r){ return String(r[0]==null?'':r[0]).length<=3; });
  const c0=short?'66px':'minmax(90px,.8fr)'; /* 66px: 3 全角字+padding 不换行(48px 会把「超自我」挤成竖排一字一行); 仍比长标签列窄且各行同宽对齐 */
  const gt=(cols===2)?(c0+' minmax(0,1.7fr)'):(c0+' repeat('+Math.max(1,cols-1)+',minmax(0,1fr))');
  const tab=el('div',{class:'rtab'});
  allRows.forEach(function(r){ const tr=el('div',{class:'tr',style:'grid-template-columns:'+gt}); r.forEach(function(c){ tr.appendChild(el('div',{class:'td jp',text:c})); }); tab.appendChild(tr); });
  return tab;
}
function figVenn(s){
  const POS={large:{a:98,b:132,r:53},medium:{a:88,b:142,r:51},small:{a:80,b:150,r:49}};
  const COL={teal:{fill:'var(--accent)',fo:'.34',stroke:'var(--accent-deep)'},blue:{fill:'var(--ok)',fo:'.24',stroke:'var(--ok-deep)'}}; // §美学: token 参照(palette 追従)+fill-opacity で透叠維持
  const sets=(s.sets&&s.sets.length>=2)?s.sets:[{label:'',color:'teal'},{label:'',color:'blue'}];
  const s0=COL[sets[0].color]||COL.teal, s1=COL[sets[1].color]||COL.blue, lc=['var(--accent-deeper)','var(--ok-deep)'];
  const ff="font-family:var(--jp)"; /* 去圆: Venn 文字随 --jp(Noto Sans JP), 不再硬编码圆体 */
  const wrap=el('div',{class:'rvenn'});
  (s.panels||[]).forEach(function(p){ const o=POS[p.overlap]||POS.medium;
    const svg='<svg viewBox="0 0 230 172" xmlns="http://www.w3.org/2000/svg">'
      +'<text x="'+(o.a-16)+'" y="26" text-anchor="middle" style="'+ff+';font-size:11px;font-weight:700;fill:'+lc[0]+'">'+svgEsc(sets[0].label)+'</text>'
      +'<text x="'+(o.b+16)+'" y="26" text-anchor="middle" style="'+ff+';font-size:11px;font-weight:700;fill:'+lc[1]+'">'+svgEsc(sets[1].label)+'</text>'
      +'<circle cx="'+o.a+'" cy="100" r="'+o.r+'" style="fill:'+s0.fill+';fill-opacity:'+s0.fo+';stroke:'+s0.stroke+'" stroke-width="1.6"/>'
      +'<circle cx="'+o.b+'" cy="100" r="'+o.r+'" style="fill:'+s1.fill+';fill-opacity:'+s1.fo+';stroke:'+s1.stroke+'" stroke-width="1.6"/>'
      +'<text x="115" y="104" text-anchor="middle" style="'+ff+';font-size:10px;font-weight:700;fill:var(--ink)">'+svgEsc(s.overlapLabel)+'</text></svg>';
    wrap.appendChild(el('div',{class:'vp'},[ el('div',{html:svg}), el('div',{class:'vcap',text:p.caption}), el('div',{class:'vnote',text:p.note}) ]));
  });
  return wrap;
}
function figBackbone(s){
  const nodes=s.nodes||[], byIdx={};
  (s.links||[]).forEach(function(l){ (byIdx[l.fromIndex]=byIdx[l.fromIndex]||[]).push(l); });
  const box=el('div',{class:'rbb'},[ el('div',{class:'spine'}) ]);
  nodes.forEach(function(n,i){ const end=(i===0||i===nodes.length-1);
    const row=el('div',{class:'bn'+(end?' end':'')},[ el('span',{class:'bead'},[ el('i') ]), el('span',{class:'pill jp',text:n.label}) ]);
    (byIdx[i]||[]).forEach(function(l){ row.appendChild(xchip(l.kai,l.concept,l.label)); });
    box.appendChild(row);
  });
  return box;
}
function figFlow(s){ const steps=s.steps||[], row=el('div',{class:'rflow'});
  steps.forEach(function(st,i){ if(i) row.appendChild(el('span',{class:'fsep',text:'↓'})); row.appendChild(el('span',{class:'fp'+(i===steps.length-1?' last':'')+' jp',text:st})); });
  return row;
}
function figLadder(s){ const box=el('div',{class:'rladder'});
  (s.rungs||[]).forEach(function(r){ box.appendChild(el('div',{class:'lrung'},[ el('span',{class:'lv',text:r.level}), el('span',{class:'ll jp',text:r.label}) ])); });
  return box;
}
function figCycle(s){ const steps=s.steps||[], row=el('div',{class:'rflow'});
  steps.forEach(function(st,i){ if(i) row.appendChild(el('span',{class:'fsep',text:'↓'})); row.appendChild(el('span',{class:'fp jp',text:st})); });
  if(s.returnLabel){ row.appendChild(el('span',{class:'fsep',text:'↩'})); row.appendChild(el('span',{class:'rcyret jp',text:s.returnLabel})); }
  return row;
}
function renderManual(tab){
  tab=tab||'kai';
  registerFrame(function(){ renderManual(tab); },'manual');
  let wrapEl=null;
  const detail=el('div',{class:'mdetail'});
  const list=el('div',{class:'card'});
  function selectRow(row){ list.querySelectorAll('.listrow.sel').forEach(function(r){ r.classList.remove('sel'); }); if(row) row.classList.add('sel'); }
  function mReduce(){ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function fadePanel(elm){ // §C 手机端列表↔详情切换: 入场面板淡入 (出场面板由 show-nav/show-detail 即时 display:none, 入场面板 opacity 0→1 升起, 无高度跳变); 桌面两栏并存(>=980)无切换故跳过; reduced-motion 跳过
    if(!elm || window.innerWidth>=980 || mReduce()) return;
    elm.classList.remove('m-fade'); elm.offsetWidth; elm.classList.add('m-fade');
    let d=false; const cl=function(e){ if(e && e.target!==elm) return; if(d) return; d=true; elm.removeEventListener('animationend',cl); elm.classList.remove('m-fade'); };
    elm.addEventListener('animationend',cl); setTimeout(cl, 600);
  }
  function emptyDetail(){ detail.innerHTML=''; detail.appendChild(el('div',{class:'mempty jp',text:t('pickFromLeft')})); }
  function backToNav(){ selectRow(null); emptyDetail(); if(wrapEl){ wrapEl.classList.remove('show-detail'); wrapEl.classList.add('show-nav'); fadePanel(wrapEl.querySelector('.mnav')); } }
  function showDetail(node,backFn){
    detail.innerHTML='';
    if(backFn) detail.appendChild(el('button',{class:'mback jp',text:backFn.label,onclick:backFn.fn}));
    detail.appendChild(node);
    if(wrapEl){ wrapEl.classList.add('show-detail'); wrapEl.classList.remove('show-nav'); }
    if(window.innerWidth<980){ detail.scrollIntoView({block:'nearest'}); fadePanel(detail); }
  }
  const nav=el('div',{class:'mnav'},[ el('div',{class:'subtabs'},[
    chipTab(t('byKai'),tab==='kai',function(){ renderManual('kai'); }),
    chipTab(t('byTopic'),tab==='topic',function(){ renderManual('topic'); }),
    chipTab(t('byConcept'),tab==='concept',function(){ renderManual('concept'); })
  ]) ]);
  if(tab==='kai'||tab==='topic'){
    const groups = tab==='kai'?App.idx.kais:App.idx.topics;
    groups.forEach(function(key){
      const ids = tab==='kai'?App.idx.kaiToQuestions[key]:App.idx.topicToQuestions[key];
      const label = tab==='kai'?('回'+key):key;
      const row=rowBtn(label,(ids||[]).length+' '+t('q'),openGroup);
      function openGroup(){
        selectRow(row);
        const lst=manualListNode(tab,key,function(id){ showDetail(readingCardNode(id),{label:label,fn:openGroup}); });
        showDetail(lst,{label:t('mBackList'),fn:backToNav});
      }
      list.appendChild(row);
    });
  } else {
    App.idx.concepts.forEach(function(c){
      const ids=App.idx.conceptToQuestions[c]||[];
      const row=rowBtn(c,(ids||[]).length+' '+t('q'),openConcept);
      function openConcept(){
        selectRow(row);
        const node=conceptCardNode(c,function(id){ showDetail(readingCardNode(id),{label:t('mBackConcept'),fn:openConcept}); });
        showDetail(node,{label:t('mBackList'),fn:backToNav});
      }
      list.appendChild(row);
    });
  }
  nav.appendChild(list);
  emptyDetail();
  wrapEl=el('div',{class:'manual2 show-nav'},[ nav, detail ]);
  setView(el('div',null,[ sectionHead(t('modeManual')), wrapEl ]), true);
}

function buildReadingReveal(q){
  const wrap=el('div',{class:'reveal'});
  const sx=LT(q.explainShort), lg=LT(q.explainLong);   /* B5: 同上 */
  if(sx||lg){
    const exw=el('div',{class:'exwrap',style:'margin-top:14px'});
    if(sx) exw.appendChild(el('div',{class:'exblock short'},[ el('div',{class:'exhd',text:t('explain')}), richExplain(sx, qTerms(q)) ]));
    if(lg) exw.appendChild(el('div',{class:'exblock long'},[ el('div',{class:'exhd',text:t('exLong')}), richExplain(lg, qTerms(q)) ]));
    wrap.appendChild(exw);
  }
  const cs=[]; (q.concepts||[]).forEach(function(c){ cs.push(c); }); (q.rubric||[]).forEach(function(r){ if(r.concept&&cs.indexOf(r.concept)<0)cs.push(r.concept); });
  if(cs.length){ const trail=el('div',{class:'trail'},[ el('div',{class:'tt',text:t('origin')}) ]);
    cs.forEach(function(c){ const meta=App.idx.conceptMeta[c]; const step=el('div',{class:'step'},[ el('span',{class:'dot'}) ]);
      if(meta&&meta.exists){ const nm=el('button',{class:'cn jp',style:'background:none;border:none;padding:0;cursor:pointer',text:c}); nm.addEventListener('click',function(){ renderConcept(c,{from:'manual',tab:'concept'}); }); step.appendChild(nm); step.appendChild(el('span',{class:'og',text:'回'+meta.origin.kai})); }
      else step.appendChild(el('span',{class:'cn jp dis',text:c}));
      trail.appendChild(step); });
    wrap.appendChild(trail); }
  return wrap;
}
