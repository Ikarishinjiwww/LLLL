'use strict';
/* ---------- runner prev/dots/next（中=进捗点；利き手镜像） ---------- */
function navRowNode(){
  const s=App.session, n=s.list.length, isLast=s.pos>=n-1, frontier=s.frontier||0;
  const nav=el('div',{class:'qnav'+(getHand()==='left'?' lefthand':'')});
  if(s.pos>0) nav.appendChild(el('button',{class:'nbtn prev',text:'‹ '+t('prev'),onclick:goPrev}));
  else nav.appendChild(el('button',{class:'nbtn prev spacer',text:'‹ '+t('prev')}));
  const dots=el('div',{class:'qdots','aria-hidden':'true'}); // F11: 進捗点は純装飾(クリック処理なし) — 読み上げ木から外す (位置は隣の qnum が言う)
  for(let i=0;i<n;i++){ dots.appendChild(el('i',{class:i===s.pos?'on':(i<frontier?'seen':'')})); }
  nav.appendChild(dots);
  nav.appendChild(el('button',{class:'nbtn next',text:(isLast?t('finish'):t('next'))+' ›',onclick:goNext}));
  return nav;
}
function fmtDuration(sec){ sec=Math.max(0,Math.round(sec)); const m=Math.floor(sec/60), s=sec%60; if(App.lang==='ja') return m>0?(m+'分'+(s>0?s+'秒':'')):(s+'秒'); return m>0?(m+' 分 '+(s>0?s+' 秒':'')):(s+' 秒'); }

/* ===================== მეიმეიトーク（V4 対話体・非主入口の浮動窓; 2026-07-13 組合実装・暂行） ===================== */
let meiEl=null;
function meiInit(){
  // 自愈型: 各部品を個別に存在保証(節点喪失→再建)。参照が腐っていても復元できる
  if(!document.getElementById('meiFloat')){
    document.body.appendChild(el('button',{class:'meiFloat',id:'meiFloat','aria-label':t('chatOpen'),text:'\u10db',onclick:openMeiChat}));
  }
  if(!document.getElementById('meiDim')){
    document.body.appendChild(el('div',{class:'meiDim',id:'meiDim',onclick:closeMeiChat}));
  }
  if(!(meiEl&&meiEl.isConnected&&document.getElementById('meiChat'))){
    if(meiEl&&meiEl.parentNode) try{ meiEl.remove(); }catch(e){}
    meiEl=el('div',{class:'meiChat',id:'meiChat',role:'dialog','aria-modal':'true','aria-label':t('chatOpen')},[ // F6: 浮層に対話框の身分と名前を与える
      el('div',{class:'mcHead'},[ el('span',{class:'mcAva',text:'\u10db'}),
        el('div',{class:'mcTt'},[ el('b',{text:'\u10db\u10d4\u10d8\u10db\u10d4\u10d8'}), el('small',{class:'jp',id:'mcSub',text:''}) ]),
        el('button',{class:'mcX','aria-label':t('back'),text:'\u2715',onclick:closeMeiChat}) ]),
      el('div',{class:'mcBody',id:'mcBody'}),
      el('div',{class:'mcChips',id:'mcChips'}) ]);
    meiEl.setAttribute('aria-hidden','true'); meiEl.inert=true;
    document.body.appendChild(meiEl);
    trapFocus(meiEl); // F6: モーダル中は Tab を浮層内で循環 (要素は再構築されうるので創建の度に張る)
  }
  if(!App._meiWatch){ // 看門狗: 節点喪失/腐参照/data-mode の exam 滞留を 1.5s 周期で自動修復（経路不問でこの類のバグを殺す）
    App._meiWatch=setInterval(function(){
      try{
        if(!document.getElementById('meiFloat')||!(meiEl&&meiEl.isConnected)){ meiInit(); }
        var inExam=!!(App.session&&App.session.mode==='exam'&&document.querySelector('.runner'));
        if(document.body.dataset.mode==='exam' && !inExam) document.body.dataset.mode='practice'; // 顕隠は CSS(body[data-mode]) に一任=復帰即時
      }catch(e){}
    },1500);
  }
}
function meiSay(msg){ const row=el('div',{class:'mcRow'},[ el('span',{class:'mcAva',text:'\u10db'}), el('div',{class:'mcBub'},[kaoWrap(msg)]) ]); document.getElementById('mcBody').appendChild(row); meiScroll(); }
function meiMe(msg){ document.getElementById('mcBody').appendChild(el('div',{class:'mcRow me'},[ el('div',{class:'mcBub',text:msg}) ])); meiScroll(); }
function meiCard(node){ document.getElementById('mcBody').appendChild(el('div',{class:'mcRow'},[ el('span',{class:'mcAva',text:'\u10db'}), node ])); meiScroll(); }
function meiScroll(){ const b=document.getElementById('mcBody'); requestAnimationFrame(function(){ b.scrollTop=b.scrollHeight; }); }
function meiChips(list){ const c=document.getElementById('mcChips'); c.innerHTML='';
  list.forEach(function(it){ c.appendChild(el('button',{class:'mcChip'+(it.ghost?' ghost':''),text:it.t,onclick:it.fn})); }); }
function openMeiChat(){
  meiInit();
  meiEl.removeAttribute('aria-hidden'); meiEl.inert=false;
  if(!App._meiInertOn){ App._meiInertOn=true; setBackdropInert(true,[meiEl,document.getElementById('meiDim')]); } // F6: 背景封鎖 (meiDim は残す=タップで閉じる維持); 旗は resetMei→close の二重呼び対策
  document.getElementById('meiDim').classList.add('on');
  meiEl.classList.add('on');
  try{ meiEl.querySelector('.mcX').focus(); }catch(e){}
  document.getElementById('mcBody').innerHTML='';
  document.getElementById('mcChips').innerHTML='';
  var left=null; try{ left=daysUntilExam(); }catch(e){}
  document.getElementById('mcSub').textContent=(left!=null&&left>0)?t('examIn').replace('{n}',left):'';
  /* 神経は「引く」ための窓。手札(chip)を並べず、話しかける口だけを置く。 */
  if(App.course && App.course.shape==='reader'){
    var ja0=App.lang==='ja';
    setTimeout(function(){
      meiSayT(ja0?'あわてなくて だいじょうぶ (｡•ᴗ•｡)':'不着急 (｡•ᴗ•｡)',function(){
        meiSayT(ja0?'なにを しらべる？':'想查点什么？',function(){ meiChips([]); meiSearchRow(); });
      });
    },260);
    return;
  }
  var wk=[]; try{ wk=topEntries(App.progress&&App.progress.weakness,1)||[]; }catch(e){}
  setTimeout(function(){ // 面板の滑入を待ってから、打字→気泡の順で 0 から生やす
    meiSayT(greetMsg(),function(){
      var next=function(){ meiSayT((left!=null&&left>0)?t('chatIn').replace('{n}',left):t('chatInNone'),meiHomeChips); };
      if(wk.length){ meiSayT(t('chatWeakHint').replace('{c}',wk[0][0]),next); } else { next(); }
    });
  },260);
}
function meiHomeChips(){
  /* コースの形で出せる手が違う。神経は問題が 11 問しかなく「苦手から10問」「模擬試験」を出しても
   * 押す先が無い(嘘の導線になる)。読む・さがす・強調点・レジュメ注意へ振る。 */
  if(App.course && App.course.shape==='reader'){ meiNeuroChips(); return; }
  meiChips([
    {t:t('chipWeak10'),fn:function(){ meiMe(t('chipWeak10')); meiChips([]); meiStartQuiz(); }},
    {t:t('chipExam'),fn:function(){ meiMe(t('chipExam')); meiSay(t('chatGoExam')); meiChips([]); setTimeout(function(){ meiGo(startExam); },650); }},
    {t:t('chipRead'),fn:function(){ meiMe(t('chipRead')); meiSay(t('chatGoRead')); meiChips([]); setTimeout(function(){ meiGo(function(){ renderManual(); }); },650); }},
    {t:t('chipSummary'),fn:meiSummary},
    {t:t('chipRest'),fn:meiRest,ghost:true},
    {t:t('chipBye'),fn:function(){ meiMe(t('chipBye')); meiSay(t('chatBye')); meiChips([]); setTimeout(closeMeiChat,1400); },ghost:true}
  ]);
}
/* Mei からそのまま用語を引けるようにする(神経は「さがす」が主動作なので、
 * chip を押して画面を移ってから入力…では遠い。ここで打てば結果まで飛ぶ)。 */
function meiSearchRow(){
  const ja=App.lang==='ja';
  const wrap=document.getElementById('mcChips');
  if(!wrap || document.getElementById('mcSearchRow')) return;
  const inp=el('input',{type:'text',class:'jp',
    placeholder:ja?'ことばを入力…':'输入词语…'});
  /* 聞かれたことは Mei が Mei の中で答える。検索画面へ飛ばすと会話が切れる。 */
  const go=function(){
    const v=(inp.value||'').trim(); if(!v) return;
    inp.value='';
    meiMe(v);
    meiChips([]);
    setTimeout(function(){ meiAnswerSearch(v); },380);
  };
  inp.addEventListener('keydown',function(e){ if(e.key==='Enter') go(); });
  const row=el('div',{class:'mcSearch',id:'mcSearchRow'},[
    inp,
    el('button',{class:'mc-send','aria-label':(ja?'送信':'发送'),onclick:go,
      html:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>'})
  ]);
  wrap.parentNode.insertBefore(row,wrap);
}
/* Mei が Mei の中で答える。
 * 引いた語の定義と要点をその場で読み上げ、続きは chip で本文へ渡す。
 * 「検索画面へ飛ばす」だと、聞いた側から見れば答えてもらえていないのと同じ。 */
function meiAnswerSearch(q){
  const ja=App.lang==='ja';
  const terms=sTerms(q);
  if(!terms.length){ meiSay(ja?'なんて読むやつだろう？もう一回教えて。':'再打一次给我看看？'); meiNeuroChips(); return; }
  const rows=buildSearchCorpus().filter(function(r){ return sHit(r.hay,terms); });
  const cons=rows.filter(function(r){ return r.kind==='concept'; });
  const bods=rows.filter(function(r){ return r.kind==='body'; });
  const cmps=rows.filter(function(r){ return r.kind==='compare'; });
  if(!cons.length && !bods.length && !cmps.length){
    meiSay(ja?('「'+q+'」は、この授業の範囲では見つからなかった。別の言い方だとどうかな。')
             :('「'+q+'」在这门课里没找到。换个说法试试？'));
    meiNeuroChips(); return;
  }
  /* 読みの完全一致 > 見出し語に含む > それ以外 */
  const score=function(r){
    const m=App.concepts?App.concepts[r.term]:null;
    const t=sNorm(r.term), y=sNorm((m&&m.yomi)||''), qq=terms.join('');
    let s=0;
    if(t===qq||y===qq) s+=100;
    if(t.indexOf(qq)===0||y.indexOf(qq)===0) s+=40;
    if(sHit(r.term,terms)) s+=25;
    return s;
  };
  cons.sort(function(a,b){ return score(b)-score(a); });
  const top=cons[0];
  if(top){
    const card=findConceptBlock(top.cardId,top.term);
    meiSay((ja?'':'')+top.term+(ja?' — ':' — ')+(top.def||''));
    if(card){
      /* 気泡は 1 行ずつ。改行文字を混ぜると「\n」がそのまま出る(実機で確認済み)。 */
      LL(card.bullets).slice(0,2).forEach(function(x){ meiSay(x); });
      if(card.caveat) meiSay(ja?('⚠ ここ、レジュメの記述が違う。'+(card.caveat.exam||''))
                               :('⚠ 这里讲义写错了。'+(card.caveat.exam||'')));
      else if(card.signal) meiSay(ja?('授業で強調されてた:「'+card.signal.quote+'」')
                                   :('课上强调过:「'+card.signal.quote+'」'));
    }
  }
  const chips=[];
  if(top) chips.push({t:ja?(top.term+' を開く'):('打开 '+top.term),
    fn:function(){ meiChips([]); setTimeout(function(){ meiGo(function(){ gotoCard(top.cardId,top.term); }); },300); }});
  cons.slice(1,4).forEach(function(r){
    chips.push({t:r.term,fn:function(){ meiChips([]); setTimeout(function(){ meiGo(function(){ gotoCard(r.cardId,r.term); }); },300); }});
  });
  if(cmps.length) chips.push({t:ja?('対比表: '+cmps[0].term):('对比表: '+cmps[0].term),
    fn:function(){ meiChips([]); setTimeout(function(){ meiGo(function(){ gotoCompare(cmps[0].gid); }); },300); }});
  const rest=cons.length+bods.length+cmps.length;
  if(rest>4) chips.push({t:ja?('ぜんぶ見る('+rest+'件)'):('全部('+rest+'条)'),
    fn:function(){ meiChips([]); setTimeout(function(){ meiGo(function(){ renderSearch(q); }); },300); },ghost:true});
  /* 「見つからなかった」時も、続けて打てるように口は残す */
  meiChips(chips);
  meiSearchRow();
}
function findConceptBlock(cardId,term){
  let hit=null;
  manualUnits().some(function(u){ return (u.sections||[]).some(function(s){
    return (s.blocks||[]).some(function(b){
      if(b.type==='concept' && (b.cardId===cardId || b.term===term)){ hit=b; return true; }
      return false; }); }); });
  return hit;
}
function meiNeuroChips(){
  /* 神経は「引く」窓。手札は並べない(2026-07-15 決定)。話しかける口だけを出す。 */
  meiChips([]);
  meiSearchRow();
}
/* 配られた問題の一覧。
 * 神経は問題が 11 問しかなく、臨床の「模擬試験→採点→復習」の輪を回す意味がない。
 * 答えと解説を最初から開いた状態で並べ、そのまま読める形にする(問いを隠して出題する側に
 * 回らせない)。「誤っているものを選べ」の問いは、正解がそのまま偽の文なので強く出す。 */
function renderQuestionList(focusQid){
  registerFrame(function(){ renderQuestionList(focusQid); },'qlist');
  const ja=App.lang==='ja';
  const qs=(App.questions||[]).slice().sort(function(a,b){ return (a.kai||0)-(b.kai||0); });
  const kids=[ sectionHead(ja?('授業で配られた問題（'+qs.length+'問）'):('课上发的练习题（'+qs.length+'题）')) ];
  const lede=el('p',{class:'ql-lede jp',
    text:ja?'答えと解説は最初から開いてあります。読んで確認するためのページです。'
           :'答案与解说默认展开。这一页是拿来读的，不是拿来考你的。'});
  kids.push(lede);
  qs.forEach(function(q,i){
    const card=el('article',{class:'ql'+(q.negative?' ql-neg':''),id:'q-'+q.id});
    const hd=el('div',{class:'ql-hd'},[
      el('span',{class:'ql-n',text:'Q'+(i+1)}),
      el('span',{class:'ql-kai',text:'第'+(q.content_kai||q.kai)+'回'}),
      el('span',{class:'ql-topic jp',text:q.topic||''})
    ]);
    if(q.negative) hd.appendChild(el('span',{class:'ql-badge jp',text:ja?'誤っているものを選べ':'选错误的'}));
    card.appendChild(hd);
    card.appendChild(el('p',{class:'ql-q jp',text:q.q||''}));
    const ol=el('div',{class:'ql-opts'});
    (q.options||[]).forEach(function(o,k){
      const row=el('div',{class:'ql-o'+(o.correct?' on':'')},[
        el('span',{class:'ql-mk',text:o.correct?'✓':String.fromCharCode(65+k)}),
        el('span',{class:'jp',text:o.t})
      ]);
      ol.appendChild(row);
    });
    card.appendChild(ol);
    if(q.negative){
      card.appendChild(el('div',{class:'ql-warn jp',
        text:ja?'✓ が付いているのは「誤った記述」です。そのまま覚えないこと。'
               :'打 ✓ 的是「错误的陈述」。别照着记。'}));
    }
    const ex=L(q.explainShort||{});
    if(ex) card.appendChild(el('div',{class:'ql-ex'},[
      el('span',{class:'ql-exl',text:ja?'解説':'解说'}), el('p',{class:'jp',text:ex}) ]));
    if((q.concepts||[]).length){
      const cr=el('div',{class:'rc-links'});
      cr.appendChild(el('span',{class:'rc-lk',text:ja?'関連':'相关'}));
      q.concepts.forEach(function(name){ cr.appendChild(relChip(name)); });
      card.appendChild(cr);
    }
    kids.push(card);
  });
  setView(el('div',null,kids));
}

function renderCaveatList(){
  registerFrame(renderCaveatList,'caveats');
  const ja=App.lang==='ja';
  const kids=[ sectionHead(ja?'レジュメの記述に注意':'讲义记述有问题') ];
  const box=caveatPanelNode(); if(box) kids.push(box);
  setView(el('div',null,kids));
}
function meiRest(){ meiMe(t('chipRest')); meiSay(pick(t('carePool'))); meiSay(pick(t('restPool')));
  meiChips([ {t:t('chipBack'),fn:function(){ meiMe(t('chipBack')); meiSay(t('chatWb')); if(meiQuiz){ meiChips([ {t:t('chatQNext'),fn:function(){ meiChips([]); meiAskNext(); }}, {t:t('chipBye'),fn:meiFinishQuiz,ghost:true} ]); } else { meiHomeChips(); } }} ]); }
function meiSummary(){
  meiMe(t('chipSummary'));
  try{
    var now=new Date(); var d0=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
    var at=(App.progress.attempts||[]);
    var today=at.filter(function(a){return a.at>=d0;}).length;
    var week=at.filter(function(a){return a.at>=d0-6*86400000;}).length;
    var wk=topEntries(App.progress.weakness,3).map(function(e){return e[0];});
    var ex=getExamHistory()[0];
    if(!today&&!week&&!wk.length&&!ex){ meiSay(t('chatSumEmpty')); }
    else{
      var card=el('div',{class:'mcCard'},[ el('div',{class:'rubt jp',text:t('chatSumTitle')}) ]);
      card.appendChild(el('div',{class:'kv'},[ el('span',{text:t('chatSumToday')}), el('span',{class:'v',text:String(today)+t('q')}) ]));
      card.appendChild(el('div',{class:'kv'},[ el('span',{text:t('chatSumWeek')}), el('span',{class:'v',text:String(week)+t('q')}) ]));
      if(ex) card.appendChild(el('div',{class:'kv'},[ el('span',{text:t('chatSumExam')}), el('span',{class:'v',text:ex.pct+'%'}) ]));
      if(wk.length) card.appendChild(el('div',{class:'kv'},[ el('span',{text:t('chatSumWeak')}), el('span',{class:'v jp',text:wk.join('\u30fb')}) ]));
      meiCard(card);
    }
  }catch(e){ meiSay(t('chatSumEmpty')); }
  meiHomeChips();
}
/* 対話内クイズ: 真題(苦手加重)を対話の中で解く。記録は recordAttempt 経由で本体と同一(見せかけ廃止) */
let meiQuiz=null;
function meiTyping(on){
  var b=document.getElementById('mcBody'); if(!b) return;
  var ex=document.getElementById('mcTypingRow');
  if(on&&!ex){ b.appendChild(el('div',{class:'mcRow',id:'mcTypingRow'},[ el('span',{class:'mcAva',text:'\u10db'}), el('div',{class:'mcBub'},[ el('span',{class:'mcTyping'},[el('i'),el('i'),el('i')]) ]) ])); meiScroll(); }
  if(!on&&ex) ex.remove();
}
function meiSayT(msg,then){
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  meiTyping(true);
  setTimeout(function(){ meiTyping(false); meiSay(msg); if(then) then(); }, reduce?0:600);
}
function meiStartQuiz(){
  try{
    var pool=C.reviewSample(App.questions,{weakness:App.progress.weakness,count:24,recentIds:App.recent},App.rng).filter(function(q){ return q.type==='choice'; });
    if(pool.length<10){ var have={}; pool.forEach(function(q){ have[q.id]=1; });
      C.reviewSample(App.questions,{count:30,recentIds:App.recent},App.rng).forEach(function(q){ if(pool.length<10&&q.type==='choice'&&!have[q.id]){ pool.push(q); have[q.id]=1; } }); }
    meiQuiz={list:pool.slice(0,10),pos:0,good:0};
    if(!meiQuiz.list.length){ meiQuiz=null; meiSayT(t('chatSumEmpty'),meiHomeChips); return; }
    meiSayT(t('chatGoWeak'),meiAskNext);
  }catch(e){ meiQuiz=null; meiSayT(t('chatSumEmpty'),meiHomeChips); }
}
function meiAskNext(){
  if(!meiQuiz||meiQuiz.pos>=meiQuiz.list.length) return meiFinishQuiz();
  var q=meiQuiz.list[meiQuiz.pos];
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  meiTyping(true);
  setTimeout(function(){
    meiTyping(false);
    var card=el('div',{class:'mcQ'});
    card.appendChild(el('div',{class:'qh'},[ el('span',{class:'pl2',text:q.kind||''}), q.topic?el('span',{class:'pl2 alt',text:q.topic}):null, el('span',{class:'pl2 alt',text:(meiQuiz.pos+1)+'/'+meiQuiz.list.length}) ]));
    card.appendChild(el('div',{class:'qt',text:q.q}));
    var order=C.shuffleOptions(q.options,App.rng);
    var ow=el('div',{class:'mcOpts'});
    order.forEach(function(o,i){
      var b=el('button',{class:'mcOpt'},[ el('span',{class:'abc',text:'ABCDEF'[i]||''}), el('span',{text:o.t}) ]);
      b.addEventListener('click',function(){ meiAnswer(q,order,ow,i); });
      ow.appendChild(b);
    });
    card.appendChild(ow);
    meiCard(card);
    meiChips([ {t:t('chipBye'),fn:meiFinishQuiz,ghost:true} ]);
  }, reduce?0:600);
}
function meiAnswer(q,order,ow,pk){
  var btns=[].slice.call(ow.querySelectorAll('.mcOpt'));
  if(btns[0]&&btns[0].disabled) return;
  btns.forEach(function(b){ b.disabled=true; });
  btns[pk].classList.add('sel');
  var good=!!order[pk].correct;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(function(){
    btns.forEach(function(b,j){ b.classList.remove('sel');
      if(order[j].correct){ b.classList.add('ok'); b.appendChild(el('span',{class:'tg',text:t('correct')})); }
      else if(j===pk){ b.classList.add('ng'); b.appendChild(el('span',{class:'tg',text:t('wrong')})); }
      else b.classList.add('dim');
    });
    try{ recordAttempt(q,{type:'choice',correct:good,ans:{selectedOption:order[pk]}}); }catch(e){}
    if(good) meiQuiz.good++;
    meiSayT(pick(good?t('encCorrect'):t('encWrong')),function(){
      var ex=el('div',{class:'mcQ'});
      ex.appendChild(el('div',{class:'qh'},[ el('span',{class:'pl2',text:t('explain')}) ]));
      ex.appendChild(el('div',{class:'mcEx',text:L(q.explainShort)||''}));
      var lg=L(q.explainLong)||'';
      if(lg){
        var more=el('button',{class:'mcMore',text:t('chatMore')+' \u25be'});
        var body=el('div',{class:'mcLong'});
        body.innerHTML=lg.replace(/</g,'&lt;').replace(/［([^］]+)］/g,function(m,x){ return '<span class="lb">'+x+'</span><br>'; });
        more.addEventListener('click',function(){ body.classList.toggle('show'); meiScroll(); });
        ex.appendChild(more); ex.appendChild(body);
      }
      meiCard(ex);
      meiQuiz.pos++;
      var last=meiQuiz.pos>=meiQuiz.list.length;
      meiChips([ {t:last?t('finish'):t('chatQNext'),fn:last?meiFinishQuiz:function(){ meiMe(t('chatQNext')); meiChips([]); meiAskNext(); }},
        {t:t('chipRest'),fn:meiRest,ghost:true},
        {t:t('chipBye'),fn:meiFinishQuiz,ghost:true} ]);
    });
  }, reduce?0:350);
}
function meiFinishQuiz(){
  if(!meiQuiz){ meiHomeChips(); return; }
  var a=meiQuiz.pos, b=meiQuiz.good; meiQuiz=null;
  meiChips([]);
  if(a>0){ meiSayT(t('chatSessSum').replace('{a}',a).replace('{b}',b),function(){ meiSay(pick(t('carePool'))); meiHomeChips(); }); }
  else { meiHomeChips(); }
}
function meiGo(fn){ closeMeiChat();
  try{ if(App.session){ pauseSessionClock(App.session); clearCareTimer(); clearRunnerTimer(); App.session=null; App.readerReturn=null; } }catch(e){}
  try{ fn(); }catch(e){}
}
/* Mei を課の切替時にまっさらへ。パネル・幕・気泡・chip・検索行を全部落とす。 */
function resetMei(){
  try{
    closeMeiChat();
    const b=document.getElementById('mcBody'); if(b) b.innerHTML='';
    const c=document.getElementById('mcChips'); if(c) c.innerHTML='';
    const sr=document.getElementById('mcSearchRow'); if(sr) sr.remove();
    const dim=document.getElementById('meiDim'); if(dim) dim.classList.remove('on');
    meiQuiz=null;
  }catch(e){}
}
function closeMeiChat(){ if(!meiEl) return; meiEl.classList.remove('on'); document.getElementById('meiDim').classList.remove('on');
  if(App._meiInertOn){ App._meiInertOn=false; setBackdropInert(false); } // F6: 背景復帰 (棧 LIFO)
  meiEl.setAttribute('aria-hidden','true'); meiEl.inert=true;
  try{ var f=document.getElementById('meiFloat'); if(f) f.focus(); }catch(e){} }
