'use strict';
/* ---------- shared node builders (used by manual two-column AND standalone pages) ---------- */
function conceptCardNode(name,onQ){
  const meta=App.idx.conceptMeta[name];
  const qids=App.idx.conceptToQuestions[name]||[];
  const card=el('div',{class:'card'});
  if(meta&&meta.exists){
    card.appendChild(el('div',{class:'exblock short'},[ el('div',{class:'exhd',text:t('explain')}), richExplain(L(meta.definition)) ]));
    card.appendChild(el('div',{class:'crumb',style:'margin-top:8px'},[ el('span',{class:'jp2',text:t('origin')}), el('span',{class:'sep',text:'›'}),
      el('b',{text:tf('kaiTag',{n:meta.origin.kai})}), el('span',{class:'jp2',text:meta.origin.section||''}) ]));
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
  if(qids.length) card.appendChild(el('button',{class:'btn',style:'margin-top:12px',text:t('cnPractice'),onclick:function(){
    const list=C.reviewSample(App.questions,{onlyIds:qids,count:Math.min(qids.length,20),recentIds:App.recent},App.rng);
    newSession('review',list,{}); renderRunner();
  }}));
  return card;
}
function readingCardNode(id){
  const q=App.idx.byId[id];
  const card=el('div',{class:'card'});
  if(isQuarantined(id)){
    card.appendChild(el('div',{class:'tags'},[ el('span',{class:'tag kind',text:q.kind}), el('span',{class:'tag kai',text:tf('kaiTag',{n:q.kai})}) ]));
    card.appendChild(qtextNode(q.q));
    card.appendChild(el('p',{class:'muted jp',style:'margin-top:12px',text:t('quarantined')}));
    return card;
  }
  card.appendChild(el('div',{class:'tags'},[ el('span',{class:'tag kind',text:q.kind}), q.topic?el('span',{class:'tag',text:q.topic}):null, el('span',{class:'tag kai',text:tf('kaiTag',{n:q.kai})}) ]));
  card.appendChild(qtextNode(q.q));
  if(q.type==='choice'){
    const ow=el('div',{class:'opts'});
    q.options.forEach(function(o){ const b=el('div',{class:'opt jp'+(o.correct?' ok':'')},[ el('span',{class:'mk',text:o.correct?'✓':''}), el('span',{text:o.t}) ]); if(o.correct) b.appendChild(el('span',{class:'lbl',text:t('correct')})); ow.appendChild(b); });
    card.appendChild(ow);
  } else {
    card.appendChild(el('div',{class:'exblock model',style:'margin-top:12px'},[ el('div',{class:'exhd',text:t('model')}), richExplain(L(q.modelAnswer), qTerms(q)) ]));
    const rb=el('div',{style:'margin-top:10px'}); rb.appendChild(el('div',{class:'rubt jp',text:t('rubricHint').split('（')[0]}));
    q.rubric.forEach(function(r){ rb.appendChild(el('div',{class:'rb',style:'cursor:default'},[ el('span',{class:'ck'}), el('div',null,[ el('div',{class:'rt jp',text:L(r.point)}), el('span',{class:'rb-st',text:r.concept}) ]) ])); });
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

/* 課程データの標題がちょうど同じ番号の「第N回」なら、序数（kaiN）と重なるので出さない（ja・zh 同じ規則） */
function dupKaiTitle(kai,title){ return typeof title==='string' && title.replace(/\s/g,'')===('第'+kai+'回'); }
/* ---------- 資料集リーダー (一節一ページ, manual.json 駆動) ---------- */
let readerDir='none'; // ページ送り方向(演出): 'fwd' 次へ / 'back' 前へ / 'none' 直接
function readerBackLabel(){ // 「‹ 」の後ろ: 実際の戻り先(前フレーム)に合わせて可変 →「資料集」固定表示が home/bookmarks へ飛ぶ誤りを解消
  const prev=(viewStack.length>1)?viewStack[viewStack.length-2].key:null;
  if(prev==='readerIndex') return t('modeManual');
  if(prev==='bookmarks') return t('actBook');
  if(prev==='home'||!prev) return t('home');
  return t('back');
}
function renderReaderIndex(){ // 資料集ホーム: 回一覧(赤框CTAの行き先)
  registerFrame(renderReaderIndex,'readerIndex');
  const units=(App.manual&&App.manual.units)?App.manual.units.slice().sort(function(a,b){return a.kai-b.kai;}):[];
  const list=el('div',{class:'ridx'});
  units.forEach(function(u){
    const n=(u.sections||[]).length, q=(u.sections||[]).reduce(function(a,s){return a+practiceCount(s);},0);
    list.appendChild(el('button',{class:'ridx-row',onclick:(function(k){return function(){ renderReader(k,0); };})(u.kai)},[
      el('span',{class:'ridx-kai',text:tf('kaiN',{n:u.kai})}),
      el('span',{class:'ridx-tx'},[ dupKaiTitle(u.kai,u.title)?null:el('b',{class:'jp',text:u.title}), el('small',{class:'jp',text:tf('ridxCount',{n:n,q:q})}) ].filter(Boolean)),
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
  if(App.course){ const pr=lsGet(nk('lastRead'),null); lsSet(nk('lastRead'),(pr&&pr.kai===kai&&pr.sec===sec&&pr.card)?pr:{kai:kai,sec:sec}); } // 続読用に最終位置を保存（同じ節を開き直すときはカード位置を消さない）
  registerFrame(function(){ renderReader(App.reader.kai,App.reader.sec); },'reader');
  document.documentElement.style.setProperty('--rdr-fs', String(parseFloat(lsGet(nk('readerFs'),1))||1));
  const pageLabel=(sec===0)?t('rdrIntro'):(secs[sec-1].sectionId+' '+(secs[sec-1].title||'')).trim(); // 節番号だけでなく節名も（窄宽で節名が消えていた：U-69）
  const bm='<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-deep)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>';
  const hd=el('div',{class:'rdr-hd'},[ el('div',{class:'rdr-crumb'},[
    el('button',{class:'rdr-back',text:'‹ '+readerBackLabel(),onclick:function(){ leaveReader(); if(viewStack.length>1) goBack(); else { App.homeTab='review'; goHome(); } }}),
    el('span',{class:'rdr-kai',text:tf('kaiN',{n:kai})}),
    el('span',{class:'rdr-pg',text:tf('kaiN',{n:kai})+' · '+pageLabel+' · '+(sec+1)+'/'+pageCount}), // 窄宽で「第2回 · 2.4 節名 · 5/6」（節の帯が吸顶しなくなったので頭に位置を出す：U-49・U-69）
    el('div',{class:'rdr-tools'},[
      el('div',{class:'rdr-fs-wrap'},[
        el('button',{class:'rdr-aa',html:'A<span style="font-size:15px">a</span>',title:t('rdrFont'),'aria-label':t('rdrFont'),'aria-expanded':'false',onclick:toggleFontPop}),
        rdrFontPop()
      ]),
      el('button',{class:'rdr-bm'+(isReaderBookmarked(kai,sec)?' on':''),html:bm,'aria-label':t('rdrBookmark'),'aria-pressed':String(isReaderBookmarked(kai,sec)),onclick:function(e){ toggleReaderBookmark(kai,sec,e.currentTarget); }})
    ])
  ]) ]);
  function tocList(chip){
    const box=el('div',{class:chip?'rdr-chips':'rdr-toc'});
    if(!chip) box.appendChild(el('div',{class:'tl',text:t('rdrToc')}));
    const add=function(idx,short,title){
      if(chip){ box.appendChild(el('button',{class:idx===sec?'on':'',text:short,onclick:function(){ gotoReader(idx); }})); }
      else { box.appendChild(el('button',{class:'ti'+(idx===sec?' on':''),onclick:function(){ gotoReader(idx); }},[ el('span',{class:'sn',text:short}), el('span',{class:'st jp',text:title}) ])); }
    };
    add(0, t('rdrCover'), t('rdrIntro'));
    secs.forEach(function(s,i){ add(i+1,s.sectionId,s.title);
      if(!chip && i+1===sec){ // 宽屏の左目次：いま開いている節は概念（カード）まで（U-41 旧課：節だけでは長い節の中で迷う）
        const cs=(s.blocks||[]).filter(function(b){ return b.type==='concept' && b.cardId && b.term; });
        if(cs.length) box.appendChild(el('div',{class:'rdr-toc-sub'},cs.map(function(b){ return el('button',{class:'tc jp','data-card':b.cardId,text:b.term,onclick:function(){
          const n=document.getElementById('c-'+b.cardId); if(n) n.scrollIntoView({block:'start'}); }}); })));
      } });
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
  App.tocOpen=function(){ openReaderToc(unit,secs,sec); }; // 窄宽（左の目次が出ない幅）は顶栏の「目次」から節名つきの一覧（U-69）
}
/* 続きから：節の中の位置（いちばん上に見えているカードとその中のずれ）も覚える（節首にしか戻れなかった：U-50）。書き手だけ・間引き */
let rdrReadTimer=null;
function readerReadSave(){
  if(rdrReadTimer) return;
  rdrReadTimer=setTimeout(function(){ rdrReadTimer=null;
    if(!App.reader || !App.course || !writerOk || !document.querySelector('#view .rdr')) return;
    const hd=document.querySelector('.rdr-hd'), top=Math.max((parseFloat(getComputedStyle(document.body).paddingTop)||52), hd?hd.getBoundingClientRect().bottom:0)+8;
    const card=Array.prototype.find.call(document.querySelectorAll('#view .rdr-main article .rc[id^="c-"]'),function(c){ return c.getBoundingClientRect().bottom>top; });
    const v={kai:App.reader.kai,sec:App.reader.sec}; if(card && window.scrollY>200){ v.card=card.id.replace(/^c-/,''); v.off=Math.round(top-card.getBoundingClientRect().top); }
    lsSet(nk('lastRead'),v);
  },600);
}
window.addEventListener('scroll',readerReadSave,{passive:true});
let rdrSpyRaf=0;
window.addEventListener('scroll',function(){ if(rdrSpyRaf) return; rdrSpyRaf=requestAnimationFrame(function(){ rdrSpyRaf=0; // 左目次の概念：いま読んでいるカードを強調
  const items=document.querySelectorAll('#view .rdr-toc-sub .tc'); if(!items.length || !items[0].offsetParent) return;
  const hd=document.querySelector('.rdr-hd'), line=Math.max((parseFloat(getComputedStyle(document.body).paddingTop)||52), hd?hd.getBoundingClientRect().bottom:0)+40;
  let cur=null; items.forEach(function(b){ const n=document.getElementById('c-'+b.dataset.card); if(n && n.getBoundingClientRect().top<=line) cur=b; });
  items.forEach(function(b){ const on=(b===cur); b.classList.toggle('on',on); if(on) b.setAttribute('aria-current','location'); else b.removeAttribute('aria-current'); }); }); },{passive:true});
function resumeReader(lr){ // 続きから読む：節を開いてからカードに錨を下ろす（図が後から届いて伸びても数回合わせ直す。利用者が動いたら止める）
  if(!lr) return; renderReader(lr.kai, lr.sec||0); if(!lr.card) return;
  const want=function(){ const n=document.getElementById('c-'+lr.card); if(!n) return null; const hd=document.querySelector('.rdr-hd'), top=Math.max((parseFloat(getComputedStyle(document.body).paddingTop)||52), hd?hd.getBoundingClientRect().bottom:0)+8; return window.scrollY+n.getBoundingClientRect().top-top+(lr.off||0); };
  let moved=false; const stop=function(){ moved=true; }, evs=['wheel','touchstart','keydown','pointerdown'];
  evs.forEach(function(ev){ window.addEventListener(ev,stop,{passive:true,capture:true}); });
  [0,120,400,900,1600].forEach(function(ms,i,arr){ setTimeout(function(){ if(!moved){ const y=want(); if(y!=null && Math.abs(window.scrollY-y)>4) window.scrollTo(0,y); }
    if(i===arr.length-1) evs.forEach(function(ev){ window.removeEventListener(ev,stop,{capture:true}); }); },ms); });
}
function readerResumeLabel(lr){ // 続読ボタンの文字：第N回 ＋ 節名（節の中なら）
  const u=(App.manual&&App.manual.units)?App.manual.units.find(function(x){ return x.kai===lr.kai; }):null, s=u&&lr.sec?(u.sections||[])[lr.sec-1]:null;
  return s?((s.sectionId+' '+(s.title||'')).trim()):(kaiTitle(lr.kai)||'');
}
function openReaderToc(unit,secs,sec){
  const rows=[{idx:0,label:t('rdrIntro')}].concat(secs.map(function(s,i){ return {idx:i+1,label:(s.sectionId+' '+(s.title||'')).trim()}; }));
  openModal(modalShell(tf('kaiN',{n:unit.kai})+'　'+t('rdrToc'),[ el('div',{class:'rx-toc'},rows.map(function(r){
    const b=el('button',{class:'rx-toc-i jp'+(r.idx===sec?' rx-toc-sec':''),text:r.label,onclick:function(){ closeModal(); if(r.idx!==sec) gotoReader(r.idx); }});
    if(r.idx===sec) b.setAttribute('aria-current','page'); return b; })) ]));
}
function gotoReader(idx){ const cur=App.reader?App.reader.sec:0; readerDir=(idx>cur)?'fwd':(idx<cur?'back':'none'); renderReader(App.reader.kai,idx); }
function leaveReader(){ document.body.classList.remove('reader-view'); App.reader=null; }
function curReaderFont(){ const v=parseFloat(document.documentElement.style.getPropertyValue('--rdr-fs')); return v||parseFloat(lsGet(nk('readerFs'),1))||1; }
function setReaderFont(v){ v=Math.max(0.85,Math.min(1.3,parseFloat(v)||1)); document.documentElement.style.setProperty('--rdr-fs',String(v)); if(App.course) lsSet(nk('readerFs'),v); }
const RDR_FS=[0.9,1,1.1,1.2,1.3]; // 文字の大きさは 5 段（滑らかな滑杆は指でもキーでも合わせにくい：S6 U-58）
function rdrFsIndex(){ const v=curReaderFont(); let k=0; RDR_FS.forEach(function(x,i){ if(Math.abs(x-v)<Math.abs(RDR_FS[k]-v)) k=i; }); return k; }
function rdrFontPop(){
  const dots=el('div',{class:'rdr-fs-dots','aria-hidden':'true'},RDR_FS.map(function(){ return el('i'); }));
  const down=el('button',{class:'rdr-fs-b','aria-label':t('rdrFontDown'),title:t('rdrFontDown'),text:'A−'}), up=el('button',{class:'rdr-fs-b big','aria-label':t('rdrFontUp'),title:t('rdrFontUp'),text:'A＋'});
  const paint=function(){ const k=rdrFsIndex(); dots.querySelectorAll('i').forEach(function(d,i){ d.classList.toggle('on',i<=k); }); down.disabled=k<=0; up.disabled=k>=RDR_FS.length-1; };
  const step=function(d){ setReaderFont(RDR_FS[Math.max(0,Math.min(RDR_FS.length-1,rdrFsIndex()+d))]); paint(); };
  down.addEventListener('click',function(){ step(-1); }); up.addEventListener('click',function(){ step(1); });
  paint();
  return el('div',{class:'rdr-fs-pop'},[ down, dots, up ]);
}
document.addEventListener('keydown',function(e){ // 読本：←／→ で前後の頁（入力中・浮層の上・修飾キーつきは奪わない）
  if(!App.reader || !document.querySelector('#view .rdr') || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  if(e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
  const tg=(e.target&&e.target.tagName||'').toLowerCase(); if(tg==='input'||tg==='textarea'||tg==='select'||(e.target&&e.target.isContentEditable)) return;
  if((typeof overlayOpen==='function' && overlayOpen()) || document.getElementById('viewer') || document.querySelector('.rdr-fs-wrap.open')) return;
  const p=document.querySelector('#view .rdr-pager'); if(!p) return;
  const b=e.key==='ArrowLeft'?p.firstElementChild:p.lastElementChild; if(b && !b.disabled){ e.preventDefault(); b.click(); }
});
function toggleFontPop(e){ // Aa の浮層：もう一度押す・外側を押す・Esc で閉じる（外側のクリックは下の控件に通さない）
  const btn=e.currentTarget, wrap=btn.parentNode;
  if(wrap._fsClose){ wrap._fsClose(false); return; }
  wrap.classList.add('open'); btn.setAttribute('aria-expanded','true');
  const onDoc=function(ev){ if(!document.body.contains(wrap)){ close(false); return; } if(!wrap.contains(ev.target)){ ev.preventDefault(); ev.stopPropagation(); close(false); } };
  const onKey=function(ev){ if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); close(true); } };
  const close=function(back){ wrap._fsClose=null; wrap.classList.remove('open'); btn.setAttribute('aria-expanded','false');
    document.removeEventListener('click',onDoc,true); document.removeEventListener('keydown',onKey,true); if(back) btn.focus(); };
  wrap._fsClose=close;
  setTimeout(function(){ if(wrap._fsClose===close){ document.addEventListener('click',onDoc,true); document.addEventListener('keydown',onKey,true); } },0);
}
function isReaderBookmarked(kai,sec){ return (lsGet(nk('readerBm'),[])||[]).indexOf(kai+':'+sec)>=0; }
function toggleReaderBookmark(kai,sec,btn){ if(!canWrite()) return; const k=kai+':'+sec; let a=lsGet(nk('readerBm'),[])||[]; const i=a.indexOf(k); if(i>=0){ a.splice(i,1); } else { a.push(k); } if(!lsSet(nk('readerBm'),a)) return; if(btn){ btn.classList.toggle('on', i<0); btn.setAttribute('aria-pressed', String(i<0)); } toast(i>=0?t('rdrBmOff'):t('rdrBmOn')); } // 書けたときだけボタンを変え、成功を知らせる（書けなければ元のまま：帯が知らせ、押し直せる。WLR1 WL-05）
function readerKaiList(){ return (App.manual&&App.manual.units)?App.manual.units.map(function(u){return u.kai;}).sort(function(a,b){return a-b;}):[]; }
function adjacentKai(kai,dir){ const ks=readerKaiList(), i=ks.indexOf(kai); if(i<0) return null; const t=ks[i+dir]; return (t==null)?null:t; } // dir=+1 次の回 / -1 前の回
function readerPageCount(kai){ const u=(App.manual&&App.manual.units)?App.manual.units.find(function(x){return x.kai===kai;}):null; return u?((u.sections||[]).length+1):1; }
function readerPager(sec,total){
  const ja=App.lang==='ja', dots=el('div',{class:'rdr-dots','aria-hidden':'true'});
  for(let i=0;i<total;i++) dots.appendChild(el('span',{class:i===sec?'on':''})); // 点は今どこかの目印だけ（約 12×44 の命中区は押しにくかった：Codex 复查 U-59）。頁の移動は 44px の前後キーと目次で
  const pgn=el('span',{class:'rdr-pgn',role:'text','aria-label':t('dotPage').replace('{n}',String(sec+1)).replace('{m}',String(total)),text:(sec+1)+'/'+total});
  const mid=el('div',{class:'rdr-pmid'},[ dots, pgn ]);
  const kai=App.reader?App.reader.kai:null;
  const prevKai=(kai!=null)?adjacentKai(kai,-1):null, nextKai=(kai!=null)?adjacentKai(kai,1):null;
  let prev; // 前へ: 節内は前節; 章頭(sec0)なら前の回の最終頁へ; 無ければ無効
  if(sec>0){ prev=el('button',{text:'‹ '+t('rdrPrev'),onclick:function(){ gotoReader(sec-1); }}); }
  else if(prevKai!=null){ prev=el('button',{class:'rdr-pg-kai',text:'‹ '+tf('kaiN',{n:prevKai}),onclick:function(){ readerDir='back'; renderReader(prevKai, readerPageCount(prevKai)-1); }}); }
  else { prev=el('button',{text:'‹ '+t('rdrPrev')}); prev.disabled=true; }
  let next; // 次へ: 節内は次節; 最終頁なら次の回の扉へ; 無ければ無効
  if(sec<total-1){ next=el('button',{text:t('rdrNext')+' ›',onclick:function(){ gotoReader(sec+1); }}); }
  else if(nextKai!=null){ next=el('button',{class:'rdr-pg-kai',text:tf('kaiN',{n:nextKai})+' ›',onclick:function(){ readerDir='fwd'; renderReader(nextKai, 0); }}); }
  else { next=el('button',{text:t('rdrNext')+' ›'}); next.disabled=true; }
  return el('div',{class:'rdr-pager'},[ prev, mid, next ]);
}
function practiceCount(sec){ return (sec.blocks||[]).filter(function(b){return b.type==='practice';}).reduce(function(a,b){return a+(b.items||[]).length;},0); }
function firstProse(sec){ const p=(sec.blocks||[]).find(function(b){return b.type==='prose';}); if(!p||!p.text) return ''; const s=p.text.replace(/\s+/g,''); return s.length>26?s.slice(0,26)+'…':s; }
function readerCover(unit,secs){
  const ja=App.lang==='ja', wrap=el('div');
  wrap.appendChild(el('div',{class:'rdr-kick',text:tf('rdrKick',{n:unit.kai})}));
  wrap.appendChild(el('h1',{class:'rdr-title jp',text:[dupKaiTitle(unit.kai,unit.title)?null:unit.title, unit.subtitle].filter(Boolean).join(' ')}));
  const totalQ=secs.reduce(function(a,s){return a+practiceCount(s);},0);
  wrap.appendChild(el('div',{class:'rdr-meta'},[
    el('b',{text:tf('rdrSecs',{n:secs.length})}), el('span',{class:'dot',text:'·'}),
    el('b',{text:tf('rdrQs',{n:totalQ})}), el('span',{class:'dot',text:'·'}),
    el('span',{text:tf('rdrSrc',{c:(App.course?L(App.course.title):''),n:unit.kai})})  /* コース名を直書きしない(2門目で誤帰属する) */
  ]));
  if(unit.lede) wrap.appendChild(el('div',{class:'rdr-lede jp'},[ el('span',{class:'pl',text:t('rdrIntro')}), document.createTextNode(unit.lede) ]));
  const flow=el('div',{class:'rdr-flow'},[ el('div',{class:'fl',text:t('rdrFlow')}) ]);
  secs.forEach(function(s,i){ const q=practiceCount(s);
    flow.appendChild(el('button',{class:'fr',onclick:function(){ gotoReader(i+1); }},[
      el('span',{class:'id',text:s.sectionId}),
      el('span',{class:'tx'},[ el('b',{class:'jp',text:s.title}), el('small',{class:'jp',text:firstProse(s)}) ]),
      el('span',{class:'cnt',text:q?tf('qCount',{n:q}):''}), el('span',{class:'ch',text:'›'})
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
   * 読む/さがす主体のコースではカードの details・対比表・教員の口頭強調・caveat・図が本体なので、
   * それらを落とさずに載せる。 */
  if(b.type==='concept')   return readerConcept(b);
  if(b.type==='compare')   return readerCompare(b);
  if(b.type==='signals')   return readerSignals(b);
  if(b.type==='selfcheck') return readerSelfcheck(b);
  return null;
}
/* 言語つき配列/文字列の取り出し(zh が空なら ja に落とす) */
/* {ja:""} のような「空の双語殻」は中身が無い。オブジェクトの真偽ではなく、
 * 言語解決後の文字列で判断する(空白のみも無しと見なす)。 */
function LT(o){ if(!o) return ''; if(typeof o==='string') return o.trim()?o:'';
  var v=(App.lang==='zh'&&typeof o.zh==='string'&&o.zh.trim())?o.zh:o.ja;
  return (typeof v==='string'&&v.trim())?v:''; }
function LL(o){ if(!o) return []; if(Array.isArray(o)) return o; var v=(App.lang==='zh'&&o.zh&&o.zh.length)?o.zh:o.ja; return v||[]; }

/* 出典は レジュメ のページだけを見せる。どこから採った情報か(スライドか話し言葉か)は
 * 作る側の来歴であって、読む側には意味が無い。ページ番号だけあれば原典に戻れる。 */
function srcChips(b){
  const ja=App.lang==='ja', row=el('div',{class:'rc-src'}), seen={};
  (b.sources||[]).forEach(function(s){
    let pg=null;
    if(s.slide!=null) pg='p'+s.slide;
    else if(s.ocr!=null) pg='p'+s.ocr;
    if(!pg) return;
    const txt=tf('srcLec',{n:s.kai,p:pg,f:(s.file?('('+s.file+')'):'')});
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
      el('div',{class:'rc-hl',text:t('rcNote')}), hl ]));
  }
  if(b.figure) box.appendChild(readerFigure2(b.figure));
  /* 図が AI 作図でも切り出しでも、分からない時はレジュメのそのページに逃げられるようにする。
   * ライブラリへの入口は作らない(各カードからだけ辿れる)。 */
  if(b.refPage) box.appendChild(refPageNode(b.refPage, b.term));
  if(b.signal) box.appendChild(signalNode(b.signal,ja));
  if(b.caveat) box.appendChild(caveatNode(b.caveat,ja));
  if((b.compare||[]).length){
    const cr=el('div',{class:'rc-links'});
    cr.appendChild(el('span',{class:'rc-lk',text:t('rcCompare')}));
    b.compare.forEach(function(gid){
      cr.appendChild(el('button',{class:'rxchip',text:compareTitle(gid)||gid,
        onclick:function(){ gotoCompare(gid); }}));
    });
    box.appendChild(cr);
  }
  if((b.related||[]).length){
    const rl=el('div',{class:'rc-links'});
    rl.appendChild(el('span',{class:'rc-lk',text:t('rcRelated')}));
    b.related.forEach(function(r){ rl.appendChild(relChip(r)); });
    box.appendChild(rl);
  }
  const sc=srcChips(b); if(sc) box.appendChild(sc);
  return box;
}
/* 図が取れなかったとき（オフラインで、この端末にまだ保存していない）：ブラウザの破れ画像と、放大键に重なる代替文字を出さず、同じ大きさの静かな枠に（S2-c1 O-01・快审第二十一批 K2-13）。
 * オンラインで失敗したときは従来どおり（理由が違うので「オフライン」とは書かない） */
function figIsOffline(){ return navigator.onLine===false; }
function figOfflineNode(){ return el('div',{class:'fig-off jp',role:'img','aria-label':t('figOffline')},[ el('span',{text:t('figOffline')}) ]); }
function figImgFallback(img,wrap){ img.addEventListener('error',function(){ if(!figIsOffline() || !wrap || wrap.querySelector('.fig-off')) return; wrap.classList.add('img-off'); wrap.appendChild(figOfflineNode()); }); }
/* 路径A(自産SVG)は本文に inline、路径C(医学図)は「原図を見に行け」の指針。
 * 医学解剖図は生成しない方針なので、白紙にも捏造にもせず、原典への正確なポインタを出す。 */
function readerFigure2(f){
  if(f.kind==='svg'){
    const w=el('figure',{class:'rc-fig'});
    const holder=el('div',{class:'rc-svg'}); holder.innerHTML=f.svg||''; uniquifySvgIds(holder); // 同節複数図の id 衝突で後続図が先頭図の名前を名乗る事故を注入時に断つ
    const sv=holder.querySelector('svg');
    if(sv) holder.appendChild(el('button',{class:'rc-zoom','aria-label':t('figZoom'),title:t('figZoom'),onclick:function(){ openViewer({svg:sv.cloneNode(true),title:f.caption||t('figTitle'),alt:f.caption||''}); }},[ el('span',{html:NEW_ICONS.search}) ])); // 描き起こした図も拡大できる（小さな字が読める大きさへ：U-46）
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
    const zoom=el('button',{class:'rc-zoom',title:t('figZoom'),'aria-label':t('figZoom'),onclick:function(){ openFigZoom(f,img.src); }},[
      el('span',{html:NEW_ICONS.search}) ]);
    const iw=el('div',{class:'rc-imgwrap'},[ img, zoom ]); figImgFallback(img,iw);
    w.appendChild(iw);
    w.appendChild(el('figcaption',{class:'jp',
      text:tf('srcLecPage',{n:f.kai,p:f.slide,f:(f.file?('('+f.file+')'):'')})}));
    return w;
  }
  if(f.kind==='slideref'){
    return el('div',{class:'rc-slideref'},[
      el('span',{class:'sr-ic',html:NEW_ICONS.book}),
      el('span',{class:'sr-t jp',text:tf('srcLecSee',{n:f.kai,p:f.slide,f:(f.file?('('+f.file+')'):'')})})
    ]);
  }
  return null;
}
/* 描き起こした図で分かりにくい時、レジュメのそのページを開ける出口。カードの中にだけ置く。 */
function refPageNode(rp, term){
  return el('button',{class:'rc-ref jp',
    onclick:function(){ openRefPage(rp, term); }},[
    el('span',{class:'rf-ic',html:NEW_ICONS.book}),
    el('span',{class:'rf-t',text:tf('refPageOpen',{n:rp.kai,p:rp.slide})}),
    el('span',{class:'rf-a',text:'›'})
  ]);
}
function openRefPage(rp, term){ // レジュメ原頁は全画面ビューアで（560px の小窓に縮めない：S6 U-14）
  openViewer({src:App.course.dir+'/'+rp.src,w:rp.w||1100,h:rp.h||800,alt:tf('refPageAlt',{t:(term||'')}),title:term||t('refPageTitle'),cap:tf('srcLecPage',{n:rp.kai,p:rp.slide,f:''})});
}

/* 図の拡大(解剖図は細部が要るので、原寸で見られる逃げ道を用意する) */
function openFigZoom(f,src){ // 「拡大」は本当に大きく：全画面ビューア（S6 U-14）
  openViewer({src:src,w:f.w||1000,h:f.h||600,alt:f.alt||'',title:f.alt||t('figTitle'),cap:tf('srcLecPage',{n:f.kai,p:f.slide,f:''})});
}
/* 教員シグナルの出典は 2 種類ある:口頭(転録の ¶)と、スライドに書かれた復習設問(p)。 */
/* 出典は レジュメ にページがある時だけ。話し言葉由来のものは出典を伏せる(表に出す意味が無い)。 */
function sigSrcText(src){
  if(!src||src.kai==null||src.slide==null) return '';
  return tf('sigSrc',{n:src.kai,f:(src.file?('('+src.file+')'):''),p:src.slide});
}
function signalNode(sg,ja){
  return el('blockquote',{class:'rc-sig'},[
    el('span',{class:'sg-l',text:t('sigLabel')}),
    el('p',{class:'jp',text:'「'+(sg.quote||'')+'」'}),
    el('span',{class:'sg-s',text:sigSrcText(sg.src)})
  ]);
}
/* caveat は「教材の字面 vs 定説」。正解を先に、教材の記載は消さずに残す。
 * 4件しかないが、そのどれもが試験で直接損をする論点なので、専用の見た目にする。 */
function caveatNode(cv,ja){
  const box=el('div',{class:'rc-cav'});
  box.appendChild(el('div',{class:'cv-hd'},[
    el('span',{class:'cv-ic',text:'!'}),
    el('b',{class:'jp',text:t('cavTitle')})
  ]));
  const zh=cv.zh||{};
  const row=function(lab,val,cls){ if(!val) return null;
    return el('div',{class:'cv-r '+cls},[ el('span',{class:'cv-l',text:lab}), el('p',{class:'jp',text:val}) ]); };
  const r1=row(t('cvCorrect'),(App.lang==='zh'&&zh.correct)?zh.correct:cv.correct,'ok');
  const r2=row(t('cvCourse'),(App.lang==='zh'&&zh.course)?zh.course:cv.course,'no');
  const r3=row(t('cvExam'),(App.lang==='zh'&&zh.exam_hint)?zh.exam_hint:cv.exam,'ex');
  [r1,r2,r3].forEach(function(r){ if(r) box.appendChild(r); });
  return box;
}
/* 対比表: 31 組すべて軸が組ごとに違う。共通軸に揃えようとすると壊れるので、
 * 1 組 = 独立した表として出す(横スクロール可)。 */
function readerCompare(b){
  const box=el('div',{class:'rc-cmp',id:'g-'+(b.id||'')});
  box.appendChild(el('div',{class:'cm-h'},[
    el('b',{class:'jp',text:b.title}),
    el('span',{class:'cm-k',text:(b.kai||[]).map(function(k){return tf('kaiN',{n:k});}).join(t('listSep'))})
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
  const box=el('div',{class:'rc-sigs'});
  box.appendChild(el('div',{class:'sgs-h'},[ el('b',{class:'jp',text:b.title}),
    el('span',{class:'sgs-c',text:tf('itemCount',{n:(b.items||[]).length})}) ]));
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
  const box=el('div',{class:'rc-self'});
  box.appendChild(el('div',{class:'sf-h jp',text:b.title||''}));
  (b.items||[]).forEach(function(it){
    box.appendChild(el('button',{class:'sf-i',onclick:function(){ gotoCard(it.cardId,it.term); }},[
      el('span',{class:'sf-q jp',text:it.quote}),
      el('span',{class:'sf-a jp',text:tf('selfSee',{t:it.term})})
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
    html:XREF_ARROW},[ document.createTextNode(tf('xchipKai',{n:kai,c:concept})) ]);
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
  const pl=el('span',{class:'pl',html:(m.icon||'')}); pl.appendChild(document.createTextNode((t('coLabel')||{})[b.variant]||b.variant)); // 判定はデータの値、表示は i18n
  const box=el('div',{class:'rco '+m.cls},[ pl ]);
  if(b.variant==='用語' && Array.isArray(b.items)){
    b.items.forEach(function(it){ box.appendChild(el('div',{class:'it'},[ el('div',{class:'term jp',text:it.term}), el('div',{class:'def jp',text:it.def}) ])); });
  } else {
    box.appendChild(el('p',{class:'tx jp',text:b.text||''}));
    if(Array.isArray(b.xref)&&b.xref.length){ const xr=el('div',{class:'rxref',style:'margin:10px 0 0'}); b.xref.forEach(function(x){ xr.appendChild(xchip(x.kai,x.concept,x.label)); }); box.appendChild(xr); }
  }
  return box;
}
function readerCrossref(b){ return el('div',{class:'rxref'},[ document.createTextNode(b.label||''), xchip(b.kai,b.concept,b.tag) ]); }
function readerPracticeTarget(ids){ // 回末から一覧へ：この回の内容の題（content_kai||kai＝今の回）に着く。手册の配布回の束ね（canonical）は変えず、着地先だけ揃える（U-15）
  const k=App.reader?App.reader.kai:null; const same=function(q){ return q && qShowKai(q)===k; };
  const inBlock=ids.filter(function(id){ return same(App.idx.byId[id]); })[0];
  const any=(App.questions||[]).filter(same)[0];
  return inBlock||(any&&any.id)||ids[0];
}
function readerPractice(b){
  const ja=App.lang==='ja', ids=(b.items||[]).map(function(it){return it.qid;});
  const idsRow=el('div',{class:'rprac-ids'});
  ids.slice(0,3).forEach(function(q){ idsRow.appendChild(el('span',{class:'qid',text:q})); });
  if(ids.length>3) idsRow.appendChild(el('span',{class:'qid more',text:'+'+(ids.length-3)}));
  return el('div',{class:'rprac'},[
    el('span',{class:'ric',html:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'}),
    el('div',{class:'rprac-h'},[ el('span',{class:'sub jp',text:b.title||t('pracTitle')}), el('span',{class:'cnt jp',text:tf((App.course&&App.course.shape==='reader')?'pracReaderCnt':'pracSecCnt',{n:ids.length})}) ]),
    idsRow,
    /* 神経(読む/さがす型)は臨床の「出題→採点」フローを使わない。答えと解説が開いた一覧へ渡す。 */
    (App.course&&App.course.shape==='reader')
      ? el('button',{class:'rprac-cta jp','aria-label':t('pracSeeQ'),
          html:t('pracSeeAns')+' ›',
          onclick:function(){ renderQuestionList(readerPracticeTarget(ids)); }})
      : el('button',{class:'rprac-cta jp','aria-label':t('pracSec'),html:t('pracSec')+' ›',onclick:function(){ startPracticeIds(ids); }})
  ]);
}
function startPracticeIds(ids){ const list=ids.map(function(id){ return App.idx.byId[id]; }).filter(Boolean); if(!list.length) return;
  const inReader=!!App.reader && document.body.classList.contains('reader-view'); // 読本が画面に出ているときだけ読本発（字標で首页へ戻った後も App.reader は残る）
  const back=inReader?{kai:App.reader.kai,sec:App.reader.sec}:null;
  /* 模擬試験の最中は、その問題が隔離されて newSession が null を返す(トーストで通知済み)。
   * セッションが無いまま runner を描く経路を断つ。 */
  App.readerReturn=back;
  if(!newSession('review',list,inReader?{from:'reader'}:{})){ App.readerReturn=null; return; }
  renderRunner(); }
function readerFigure(b){
  const fig=el('figure',{class:'rfig'},[ el('figcaption',{class:'rfig-cap'},[ el('span',{class:'tag',text:tf('figTag',{k:((t('figKind')||{})[b.kind]||b.kind)})}), el('span',{class:'tt jp',text:b.title||''}) ]) ]);
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
  const COL={teal:{fill:'var(--accent)',fo:'.34',stroke:'var(--accent-deep)'},blue:{fill:'var(--ok)',fo:'.24',stroke:'var(--ok-deep)'}}; // token 参照(palette 追従)+fill-opacity で透叠維持
  const sets=(s.sets&&s.sets.length>=2)?s.sets:[{label:'',color:'teal'},{label:'',color:'blue'}];
  const s0=COL[sets[0].color]||COL.teal, s1=COL[sets[1].color]||COL.blue, lc=['var(--accent-deeper)','var(--ok-deep)'];
  const ff="font-family:var(--jp)"; /* Venn 文字随 --jp(Noto Sans JP), 不硬编码圆体 */
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
/* ---------- MANUAL (手册): two-column master / detail; degrades to paged on narrow ---------- */
function renderManual(tab){
  tab=tab||'kai';
  registerFrame(function(){ renderManual(tab); },'manual');
  let wrapEl=null;
  const detail=el('div',{class:'mdetail'});
  const list=el('div',{class:'card'});
  function selectRow(row){ list.querySelectorAll('.listrow.sel').forEach(function(r){ r.classList.remove('sel'); }); if(row) row.classList.add('sel'); }
  function mReduce(){ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function fadePanel(elm){ // 手机端列表↔详情切换: 入场面板淡入 (出场面板由 show-nav/show-detail 即时 display:none, 入场面板 opacity 0→1 升起, 无高度跳变); 桌面两栏并存(>=980)无切换故跳过; reduced-motion 跳过
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
      const label = tab==='kai'?tf('kaiTag',{n:key}):key;
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
  const sx=LT(q.explainShort), lg=LT(q.explainLong);   /* LT: 空の双語殻を無しと見なす */
  if(sx||lg){
    const exw=el('div',{class:'exwrap',style:'margin-top:14px'});
    if(sx) exw.appendChild(el('div',{class:'exblock short'},[ el('div',{class:'exhd',text:t('explain')}), richExplain(sx, qTerms(q)) ]));
    if(lg) exw.appendChild(el('div',{class:'exblock long'},[ el('div',{class:'exhd',text:t('exLong')}), richExplain(lg, qTerms(q)) ]));
    wrap.appendChild(exw);
  }
  const cs=[]; (q.concepts||[]).forEach(function(c){ cs.push(c); }); (q.rubric||[]).forEach(function(r){ if(r.concept&&cs.indexOf(r.concept)<0)cs.push(r.concept); });
  if(cs.length){ const trail=el('div',{class:'trail'},[ el('div',{class:'tt',text:t('origin')}) ]);
    cs.forEach(function(c){ const meta=App.idx.conceptMeta[c]; const step=el('div',{class:'step'},[ el('span',{class:'dot'}) ]);
      if(meta&&meta.exists){ const nm=el('button',{class:'cn jp',style:'background:none;border:none;padding:0;cursor:pointer',text:c}); nm.addEventListener('click',function(){ renderConcept(c,{from:'manual',tab:'concept'}); }); step.appendChild(nm); step.appendChild(el('span',{class:'og',text:tf('kaiTag',{n:meta.origin.kai})})); }
      else step.appendChild(el('span',{class:'cn jp dis',text:c}));
      trail.appendChild(step); });
    wrap.appendChild(trail); }
  return wrap;
}

