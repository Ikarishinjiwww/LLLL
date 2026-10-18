'use strict';
/* ---------- runner prev/dots/next（中=进捗点；利き手镜像） ---------- */
function navRowNode(){
  const s=App.session, n=s.list.length, isLast=s.pos>=n-1, frontier=s.frontier||0;
  const nav=el('div',{class:'qnav'+(getHand()==='left'?' lefthand':'')});
  if(s.pos>0) nav.appendChild(el('button',{class:'nbtn prev',text:'‹ '+t('prev'),onclick:goPrev}));
  else nav.appendChild(el('button',{class:'nbtn prev spacer',text:'‹ '+t('prev')}));
  const dots=el('div',{class:'qdots','aria-hidden':'true'}); // 進捗点は純装飾(クリック処理なし) — 読み上げ木から外す (位置は隣の qnum が言う)
  for(let i=0;i<n;i++){ dots.appendChild(el('i',{class:i===s.pos?'on':(i<frontier?'seen':'')})); }
  nav.appendChild(dots);
  nav.appendChild(el('button',{class:'nbtn next',text:(isLast?t('finish'):t('next'))+' ›',onclick:goNext}));
  return nav;
}
function fmtDuration(sec){ sec=Math.max(0,Math.round(sec)); const m=Math.floor(sec/60), s=sec%60; return m>0?(tf('durMin',{m:m})+(s>0?tf('durSec',{s:s}):'')):tf('durSec',{s:s}); }

/* ===================== トーク（対話体・非主入口の浮動窓） ===================== */
let buddyEl=null;
function buddyInit(){
  // 自愈型: 各部品を個別に存在保証(節点喪失→再建)。参照が腐っていても復元できる
  if(!document.getElementById('buddyFloat')){
    document.body.appendChild(el('button',{class:'buddyFloat',id:'buddyFloat','aria-label':t('chatOpen'),text:'\u10db',onclick:openBuddyChat}));
  }
  if(!document.getElementById('buddyDim')){
    document.body.appendChild(el('div',{class:'buddyDim',id:'buddyDim',onclick:closeBuddyChat}));
  }
  if(!(buddyEl&&buddyEl.isConnected&&document.getElementById('buddyChat'))){
    if(buddyEl&&buddyEl.parentNode) try{ buddyEl.remove(); }catch(e){}
    buddyEl=el('div',{class:'buddyChat',id:'buddyChat',role:'dialog','aria-modal':'true','aria-label':t('chatOpen')},[ // 浮層に対話框の身分と名前を与える
      el('div',{class:'mcHead'},[ el('span',{class:'mcAva',text:'\u10db'}),
        el('div',{class:'mcTt'},[ el('b',{text:'\u10db\u10d4\u10d8\u10db\u10d4\u10d8'}), el('small',{class:'jp',id:'mcSub',text:''}) ]),
        el('button',{class:'mcX','aria-label':t('close'),text:'\u2715',onclick:closeBuddyChat}) ]), // \u300c\u623b\u308b\u300d\u3067\u306a\u304f\u300c\u9589\u3058\u308b\u300d
      el('div',{class:'mcBody',id:'mcBody'}),
      el('div',{class:'mcChips',id:'mcChips'}) ]);
    buddyEl.setAttribute('aria-hidden','true'); buddyEl.inert=true;
    document.body.appendChild(buddyEl);
    trapFocus(buddyEl); // モーダル中は Tab を浮層内で循環 (要素は再構築されうるので創建の度に張る)
  }
  if(!App._buddyWatch){ // 看門狗: 節点喪失/腐参照/data-mode の exam 滞留を 1.5s 周期で自動修復（経路不問でこの類のバグを殺す）
    App._buddyWatch=setInterval(function(){
      try{
        if(!document.getElementById('buddyFloat')||!(buddyEl&&buddyEl.isConnected)){ buddyInit(); }
        var inExam=!!(App.session&&App.session.mode==='exam'&&document.querySelector('.runner'));
        if(document.body.dataset.mode==='exam' && !inExam) document.body.dataset.mode='practice'; // 顕隠は CSS(body[data-mode]) に一任=復帰即時
      }catch(e){}
    },1500);
  }
}
function buddySay(msg){ const row=el('div',{class:'mcRow'},[ el('span',{class:'mcAva',text:'\u10db'}), el('div',{class:'mcBub'},[kaoWrap(msg)]) ]); document.getElementById('mcBody').appendChild(row); buddyScroll(); }
function buddyMe(msg){ document.getElementById('mcBody').appendChild(el('div',{class:'mcRow me'},[ el('div',{class:'mcBub',text:msg}) ])); buddyScroll(); }
function buddyCard(node){ const b=document.getElementById('mcBody'), row=el('div',{class:'mcRow'},[ el('span',{class:'mcAva',text:'\u10db'}), node ]); b.appendChild(row);
  requestAnimationFrame(function(){ b.scrollTop=Math.max(0,b.scrollTop+row.getBoundingClientRect().top-b.getBoundingClientRect().top-8); }); } // 位置は滚动区 #mcBody 基準で（offsetTop は #buddyChat 基準で約 61px ずれていた：复查 U-36） // カード（小テストの問題など）は頭から見せる：底まで送ると題干が隠れる（S6 U-36）
function buddyScroll(){ const b=document.getElementById('mcBody'); requestAnimationFrame(function(){ b.scrollTop=b.scrollHeight; }); }
function buddyChips(list){ const c=document.getElementById('mcChips'); c.innerHTML='';
  list.forEach(function(it){ c.appendChild(el('button',{class:'mcChip'+(it.ghost?' ghost':''),text:it.t,onclick:it.fn})); }); }
function openBuddyChat(){
  buddyInit();
  buddyEl.removeAttribute('aria-hidden'); buddyEl.inert=false;
  if(!App._buddyInertOn){ App._buddyInertOn=true; setBackdropInert(true,[buddyEl,document.getElementById('buddyDim')]); } // 背景封鎖 (buddyDim は残す=タップで閉じる維持); 旗は resetBuddy→close の二重呼び対策
  document.getElementById('buddyDim').classList.add('on');
  buddyEl.classList.add('on');
  if(typeof navSync==='function') navSync(); // 開いている間は「戻る」でまず閉じる（首页でも見張りを置く：CR-06）
  try{ buddyEl.querySelector('.mcX').focus(); }catch(e){}
  document.getElementById('mcBody').innerHTML='';
  document.getElementById('mcChips').innerHTML='';
  var left=null; try{ left=daysUntilExam(); }catch(e){}
  document.getElementById('mcSub').textContent=(left!=null&&left>0)?t('examIn').replace('{n}',left):'';
  /* 神経は「引く」ための窓。手札(chip)を並べず、話しかける口だけを置く。 */
  if(App.course && App.course.shape==='reader'){
    buddyChips([]); buddySearchRow(); // 入力欄は最初から（あいさつの打字を待たせない：S6 U-88）
    setTimeout(function(){
      buddySayT(t('bdCalm'),function(){ buddySayT(t('bdAsk')); });
    },260);
    return;
  }
  var wk=[]; try{ wk=topEntries(App.progress&&App.progress.weakness,1)||[]; }catch(e){}
  buddyHomeChips(); // 選べる手は最初から出す（あいさつの打字を待たせない：S6 U-88）
  setTimeout(function(){ // 面板の滑入を待ってから、打字→気泡の順で 0 から生やす
    buddySayT(greetMsg(),function(){
      var next=function(){ buddySayT((left!=null&&left>0)?t('chatIn').replace('{n}',left):t('chatInNone')); };
      if(wk.length){ buddySayT(t('chatWeakHint').replace('{c}',wk[0][0]),next); } else { next(); }
    });
  },260);
}
function buddyHomeChips(){
  /* コースの形で出せる手が違う。神経は問題が 11 問しかなく「苦手から10問」「模擬試験」を出しても
   * 押す先が無い(嘘の導線になる)。読む・さがす・強調点・レジュメ注意へ振る。 */
  if(App.course && App.course.shape==='reader'){ buddyNeuroChips(); return; }
  buddyChips([
    {t:t('chipWeak10'),fn:function(){ buddyMe(t('chipWeak10')); buddyChips([]); buddyStartQuiz(); }},
    {t:t('chipExam'),fn:function(){ buddyMe(t('chipExam')); buddySay(t('chatGoExam')); buddyChips([]); setTimeout(function(){ buddyGo(startExam); },650); }},
    {t:t('chipRead'),fn:function(){ buddyMe(t('chipRead')); buddySay(t('chatGoRead')); buddyChips([]); setTimeout(function(){ buddyGo(function(){ renderManual(); }); },650); }},
    {t:t('chipSummary'),fn:buddySummary},
    {t:t('chipRest'),fn:buddyRest,ghost:true},
    {t:t('chipBye'),fn:function(){ buddyMe(t('chipBye')); buddySay(t('chatBye')); buddyChips([]); setTimeout(closeBuddyChat,1400); },ghost:true}
  ]);
}
/* そのまま用語を引けるようにする(神経は「さがす」が主動作なので、
 * chip を押して画面を移ってから入力…では遠い。ここで打てば結果まで飛ぶ)。 */
function buddySearchRow(){
  const wrap=document.getElementById('mcChips');
  if(!wrap || document.getElementById('mcSearchRow')) return;
  const inp=el('input',{type:'text',class:'jp',
    placeholder:t('bdInputPh')});
  /* 聞かれたことは窓の中で答える。検索画面へ飛ばすと会話が切れる。 */
  const go=function(){
    const v=(inp.value||'').trim(); if(!v) return;
    inp.value='';
    buddyMe(v);
    buddyChips([]);
    setTimeout(function(){ buddyAnswerSearch(v); },380);
  };
  inp.addEventListener('keydown',function(e){ if(e.key==='Enter') go(); });
  const row=el('div',{class:'mcSearch',id:'mcSearchRow'},[
    inp,
    el('button',{class:'mc-send','aria-label':t('bdSend'),onclick:go,
      html:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>'})
  ]);
  wrap.parentNode.insertBefore(row,wrap);
}
/* 引いた語の定義と要点をその場で読み上げ、続きは chip で本文へ渡す。
 * 「検索画面へ飛ばす」だと、聞いた側から見れば答えてもらえていないのと同じ。 */
function buddyAnswerSearch(q){
  const terms=sTerms(q);
  if(!terms.length){ buddySay(t('bdAgain')); buddyNeuroChips(); return; }
  const rows=buildSearchCorpus().filter(function(r){ return sHit(r.hay,terms); });
  const cons=rows.filter(function(r){ return r.kind==='concept'; });
  const bods=rows.filter(function(r){ return r.kind==='body'; });
  const cmps=rows.filter(function(r){ return r.kind==='compare'; });
  if(!cons.length && !bods.length && !cmps.length){
    buddySay(tf('bdNotFound',{q:q}));
    buddyNeuroChips(); return;
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
    buddySay(top.term+' — '+(top.def||''));
    if(card){
      /* 気泡は 1 行ずつ。改行文字を混ぜると「\n」がそのまま出る(実機で確認済み)。 */
      LL(card.bullets).slice(0,2).forEach(function(x){ buddySay(x); });
      if(card.caveat) buddySay(tf('bdCaveat',{e:(card.caveat.exam||'')}));
      else if(card.signal) buddySay(tf('bdSignal',{q:card.signal.quote}));
    }
  }
  const chips=[];
  if(top) chips.push({t:tf('bdOpen',{t:top.term}),
    fn:function(){ buddyChips([]); setTimeout(function(){ buddyGo(function(){ gotoCard(top.cardId,top.term); }); },300); }});
  cons.slice(1,4).forEach(function(r){
    chips.push({t:r.term,fn:function(){ buddyChips([]); setTimeout(function(){ buddyGo(function(){ gotoCard(r.cardId,r.term); }); },300); }});
  });
  if(cmps.length) chips.push({t:tf('bdCompare',{t:cmps[0].term}),
    fn:function(){ buddyChips([]); setTimeout(function(){ buddyGo(function(){ gotoCompare(cmps[0].gid); }); },300); }});
  const rest=cons.length+bods.length+cmps.length;
  if(rest>4) chips.push({t:tf('bdAll',{n:rest}),
    fn:function(){ buddyChips([]); setTimeout(function(){ buddyGo(function(){ renderSearch(q); }); },300); },ghost:true});
  /* 「見つからなかった」時も、続けて打てるように口は残す */
  buddyChips(chips);
  buddySearchRow();
}
function findConceptBlock(cardId,term){
  let hit=null;
  manualUnits().some(function(u){ return (u.sections||[]).some(function(s){
    return (s.blocks||[]).some(function(b){
      if(b.type==='concept' && (b.cardId===cardId || b.term===term)){ hit=b; return true; }
      return false; }); }); });
  return hit;
}
function buddyNeuroChips(){
  /* 神経は「引く」窓。手札は並べない。話しかける口だけを出す。 */
  buddyChips([]);
  buddySearchRow();
}
/* 配られた問題の一覧。
 * 神経は問題が 11 問しかなく、臨床の「模擬試験→採点→復習」の輪を回す意味がない。
 * 答えと解説を最初から開いた状態で並べ、そのまま読める形にする(問いを隠して出題する側に
 * 回らせない)。「誤っているものを選べ」の問いは、正解がそのまま偽の文なので強く出す。 */
function renderQuestionList(focusQid){
  registerFrame(function(){ renderQuestionList(focusQid); },'qlist');
  const qs=(App.questions||[]).slice().sort(function(a,b){ return (a.kai||0)-(b.kai||0); });
  const kids=[ sectionHead(tf('qlTitle',{n:qs.length})) ];
  const lede=el('p',{class:'ql-lede jp',
    text:t(feat('answerFirst')?'qlLedeTry':'qlLede')}); // 先答後看スイッチが入っているときは「解いてみる」に触れる説明へ（切れば原文）
  kids.push(lede);
  /* 章程第 21 条：一覧は答えを開いたまま。スイッチが入っていれば、同じ問題を先答後看で解く入口と今日の復習を添える（S1-d） */
  const tools=el('div',{class:'rx-tools ql-tools'});
  if(feat('answerFirst')) tools.appendChild(el('button',{class:'btn sm jp',text:t('qlTry'),onclick:function(){ if(newSession('review',qs.slice(),{})) renderRunner(); }}));
  if(feat('spaced')){ const n=spQueue().length; if(n) tools.appendChild(el('button',{class:'btn ghost sm jp',text:t('rxReviewToday')+'　'+tf('rxReviewN',{n:n}),onclick:spReviewRun})); }
  if(tools.childNodes.length) kids.push(tools);
  qs.forEach(function(q,i){
    const card=el('article',{class:'ql'+(q.negative?' ql-neg':''),id:'q-'+q.id});
    const hd=el('div',{class:'ql-hd'},[
      el('span',{class:'ql-n',text:'Q'+(i+1)}),
      el('span',{class:'ql-kai',text:tf('kaiN',{n:(q.content_kai||q.kai)})}),
      el('span',{class:'ql-topic jp',text:q.topic||''})
    ]);
    if(q.negative) hd.appendChild(el('span',{class:'ql-badge jp',text:t('qlNegative')}));
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
        text:t('qlNegNote')}));
    }
    const ex=L(q.explainShort||{});
    if(ex) card.appendChild(el('div',{class:'ql-ex'},[
      el('span',{class:'ql-exl',text:t('qlExpl')}), el('p',{class:'jp',text:ex}) ]));
    if((q.concepts||[]).length){
      const cr=el('div',{class:'rc-links'});
      cr.appendChild(el('span',{class:'rc-lk',text:t('rcRelated')}));
      q.concepts.forEach(function(name){ cr.appendChild(relChip(name)); });
      card.appendChild(cr);
    }
    kids.push(card);
  });
  setView(el('div',null,kids));
  if(focusQid) requestAnimationFrame(function(){ const c=document.getElementById('q-'+focusQid); if(c){ c.scrollIntoView({block:'start'}); c.classList.add('rc-flash'); } }); // 回末「答えと解説を見る」：その回の問題の所へ（S6 U-15）
}

/* 现无 UI 入口（入口缺失，非废弃）：复活或退役待裁定，勿当死代码删除。 */
function renderCaveatList(){
  registerFrame(renderCaveatList,'caveats');
  const kids=[ sectionHead(t('cavTitle')) ];
  const box=caveatPanelNode(); if(box) kids.push(box);
  setView(el('div',null,kids));
}
function buddyRest(){ buddyMe(t('chipRest')); buddySay(pick(t('carePool'))); buddySay(pick(t('restPool')));
  buddyChips([ {t:t('chipBack'),fn:function(){ buddyMe(t('chipBack')); buddySay(t('chatWb')); if(buddyQuiz){ buddyChips([ {t:t('chatQNext'),fn:function(){ buddyChips([]); buddyAskNext(); }}, {t:t('chipBye'),fn:buddyFinishQuiz,ghost:true} ]); } else { buddyHomeChips(); } }} ]); }
function buddySummary(){
  buddyMe(t('chipSummary'));
  try{
    var now=new Date(); var d0=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
    var at=(App.progress.attempts||[]);
    var today=at.filter(function(a){return a.at>=d0;}).length;
    var week=at.filter(function(a){return a.at>=d0-6*86400000;}).length;
    var wk=topEntries(App.progress.weakness,3).map(function(e){return e[0];});
    var ex=getExamHistory()[0];
    if(!today&&!week&&!wk.length&&!ex){ buddySay(t('chatSumEmpty')); }
    else{
      var card=el('div',{class:'mcCard'},[ el('div',{class:'rubt jp',text:t('chatSumTitle')}) ]);
      card.appendChild(el('div',{class:'kv'},[ el('span',{text:t('chatSumToday')}), el('span',{class:'v',text:String(today)+t('q')}) ]));
      card.appendChild(el('div',{class:'kv'},[ el('span',{text:t('chatSumWeek')}), el('span',{class:'v',text:String(week)+t('q')}) ]));
      if(ex) card.appendChild(el('div',{class:'kv'},[ el('span',{text:t('chatSumExam')}), el('span',{class:'v',text:ex.pct+'%'}) ]));
      if(wk.length) card.appendChild(el('div',{class:'kv'},[ el('span',{text:t('chatSumWeak')}), el('span',{class:'v jp',text:wk.join('\u30fb')}) ]));
      buddyCard(card);
    }
  }catch(e){ buddySay(t('chatSumEmpty')); }
  buddyHomeChips();
}
/* 対話内クイズ: 真題(苦手加重)を対話の中で解く。記録は recordAttempt 経由で本体と同一 */
let buddyQuiz=null;
function buddyTyping(on){
  var b=document.getElementById('mcBody'); if(!b) return;
  var ex=document.getElementById('mcTypingRow');
  if(on&&!ex){ b.appendChild(el('div',{class:'mcRow',id:'mcTypingRow'},[ el('span',{class:'mcAva',text:'\u10db'}), el('div',{class:'mcBub'},[ el('span',{class:'mcTyping'},[el('i'),el('i'),el('i')]) ]) ])); buddyScroll(); }
  if(!on&&ex) ex.remove();
}
function buddySayT(msg,then){
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  buddyTyping(true);
  setTimeout(function(){ buddyTyping(false); buddySay(msg); if(then) then(); }, reduce?0:600);
}
function buddyStartQuiz(){
  try{
    var pool=C.reviewSample(App.questions,{weakness:App.progress.weakness,count:24,recentIds:App.recent},App.rng).filter(function(q){ return q.type==='choice'; });
    if(pool.length<10){ var have={}; pool.forEach(function(q){ have[q.id]=1; });
      C.reviewSample(App.questions,{count:30,recentIds:App.recent},App.rng).forEach(function(q){ if(pool.length<10&&q.type==='choice'&&!have[q.id]){ pool.push(q); have[q.id]=1; } }); }
    buddyQuiz={list:pool.slice(0,10),pos:0,good:0};
    if(!buddyQuiz.list.length){ buddyQuiz=null; buddySayT(t('chatSumEmpty'),buddyHomeChips); return; }
    buddySayT(t('chatGoWeak'),buddyAskNext);
  }catch(e){ buddyQuiz=null; buddySayT(t('chatSumEmpty'),buddyHomeChips); }
}
function buddyAskNext(){
  if(!buddyQuiz||buddyQuiz.pos>=buddyQuiz.list.length) return buddyFinishQuiz();
  var q=buddyQuiz.list[buddyQuiz.pos];
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  buddyTyping(true);
  setTimeout(function(){
    buddyTyping(false);
    var card=el('div',{class:'mcQ'});
    card.appendChild(el('div',{class:'qh'},[ el('span',{class:'pl2',text:q.kind||''}), q.topic?el('span',{class:'pl2 alt',text:q.topic}):null, el('span',{class:'pl2 alt',text:(buddyQuiz.pos+1)+'/'+buddyQuiz.list.length}) ]));
    card.appendChild(el('div',{class:'qt',text:q.q}));
    var order=C.shuffleOptions(q.options,App.rng);
    var ow=el('div',{class:'mcOpts'});
    order.forEach(function(o,i){
      var b=el('button',{class:'mcOpt'},[ el('span',{class:'abc',text:'ABCDEF'[i]||''}), el('span',{text:o.t}) ]);
      b.addEventListener('click',function(){ buddyAnswer(q,order,ow,i); });
      ow.appendChild(b);
    });
    card.appendChild(ow);
    buddyCard(card);
    buddyChips([ {t:t('chipBye'),fn:buddyFinishQuiz,ghost:true} ]);
  }, reduce?0:600);
}
/* talk の小テストも数字キーで答えられるように（U-77：浮層が開いている間は本体のキー操作が止まるため、ここで受ける） */
document.addEventListener('keydown',function(e){
  if(!buddyEl || !buddyEl.classList.contains('on') || !/^[1-6]$/.test(e.key) || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
  var tg=(e.target&&e.target.tagName||'').toLowerCase(); if(tg==='input'||tg==='textarea') return;
  var sets=buddyEl.querySelectorAll('.mcOpts'), last=sets[sets.length-1]; if(!last) return;
  var b=last.querySelectorAll('.mcOpt')[+e.key-1]; if(b && !b.disabled){ e.preventDefault(); b.click(); }
});
function buddyAnswer(q,order,ow,pk){
  if(!canWrite() || quotaStopped()) return; if(!quotaAdmit) return quotaAdmitted(buddyAnswer,this,arguments); // 準入したら一笔を割らずに書く（WLR2 必修 2）。書けない（只読・準備中・容量の 90% 以上）ときは選択肢も変えない：判定だけ出て記録されないのを防ぐ（WLR1 合并裁定 三-5）
  var btns=[].slice.call(ow.querySelectorAll('.mcOpt'));
  if(btns[0]&&btns[0].disabled) return;
  btns.forEach(function(b){ b.disabled=true; });
  btns[pk].classList.add('sel');
  var good=!!order[pk].correct;
  var cid=App.course&&App.course.id, quiz=buddyQuiz; // 作答したときの課と小テスト（X16b-01）
  var live=function(){ return !!quiz && buddyQuiz===quiz && !!App.course && App.course.id===cid; }; // 切課（resetBuddy）・小テスト終了で古い回調は無効
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(function(){
    if(!live()) return; // 課が替わった／小テストが終わった：別の課へ書かない（sched・progress とも）。表示もしない
    btns.forEach(function(b,j){ b.classList.remove('sel');
      if(order[j].correct){ b.classList.add('ok'); b.appendChild(el('span',{class:'tg',text:feat('optionMarks')?t('optAns'):t('correct')})); } // 選択肢の身分（スイッチ off は 4.0.0 の表示：X16-05）
      else if(j===pk){ b.classList.add('ng'); b.appendChild(el('span',{class:'tg',text:feat('optionMarks')?t('optPicked'):t('wrong')})); } // runner と同じ標示（快审第十二批）
      else b.classList.add('dim');
    });
    try{ spRecord([{id:q.id,ok:good,unsure:false}]); }catch(e){} // 小テストの作答も今日の復習へ（X16-04。誤答集合で初期化するため recordAttempt より先）
    try{ recordAttempt(q,{type:'choice',correct:good,ans:{selectedOption:order[pk]}}); }catch(e){}
    if(good) buddyQuiz.good++;
    buddySayT(pick(good?t('encCorrect'):t('encWrong')),function(){
      if(!live()) return;
      var ex=el('div',{class:'mcQ'});
      ex.appendChild(el('div',{class:'qh'},[ el('span',{class:'pl2',text:t('explain')}) ]));
      ex.appendChild(el('div',{class:'mcEx',text:L(q.explainShort)||''}));
      var lg=L(q.explainLong)||'';
      if(lg){
        var more=el('button',{class:'mcMore',text:t('chatMore')+' \u25be'});
        var body=el('div',{class:'mcLong'});
        body.innerHTML=lg.replace(/</g,'&lt;').replace(/［([^］]+)］/g,function(m,x){ return '<span class="lb">'+x+'</span><br>'; });
        more.addEventListener('click',function(){ body.classList.toggle('show'); buddyScroll(); });
        ex.appendChild(more); ex.appendChild(body);
      }
      buddyCard(ex);
      buddyQuiz.pos++;
      var last=buddyQuiz.pos>=buddyQuiz.list.length;
      buddyChips([ {t:last?t('finish'):t('chatQNext'),fn:last?buddyFinishQuiz:function(){ buddyMe(t('chatQNext')); buddyChips([]); buddyAskNext(); }},
        {t:t('chipRest'),fn:buddyRest,ghost:true},
        {t:t('chipBye'),fn:buddyFinishQuiz,ghost:true} ]);
    });
  }, reduce?0:350);
}
function buddyFinishQuiz(){
  if(!buddyQuiz){ buddyHomeChips(); return; }
  var a=buddyQuiz.pos, b=buddyQuiz.good; buddyQuiz=null;
  buddyChips([]);
  if(a>0){ buddySayT(t('chatSessSum').replace('{a}',a).replace('{b}',b),function(){ buddySay(pick(t('carePool'))); buddyHomeChips(); }); }
  else { buddyHomeChips(); }
}
function buddyGo(fn){ closeBuddyChat();
  try{ if(App.session){ examDropClean(); pauseSessionClock(App.session); clearCareTimer(); clearRunnerTimer(); App.session=null; App.readerReturn=null; } }catch(e){}
  try{ fn(); }catch(e){}
}
/* 課の切替時にまっさらへ。パネル・幕・気泡・chip・検索行を全部落とす。 */
function resetBuddy(){
  try{
    closeBuddyChat();
    const b=document.getElementById('mcBody'); if(b) b.innerHTML='';
    const c=document.getElementById('mcChips'); if(c) c.innerHTML='';
    const sr=document.getElementById('mcSearchRow'); if(sr) sr.remove();
    const dim=document.getElementById('buddyDim'); if(dim) dim.classList.remove('on');
    buddyQuiz=null;
  }catch(e){}
}
function closeBuddyChat(){ if(!buddyEl) return; const wasOpen=buddyEl.classList.contains('on'); buddyEl.classList.remove('on'); document.getElementById('buddyDim').classList.remove('on');
  if(App._buddyInertOn){ App._buddyInertOn=false; setBackdropInert(false); } // 背景復帰 (棧 LIFO)
  buddyEl.setAttribute('aria-hidden','true'); buddyEl.inert=true;
  if(wasOpen){ try{ var f=document.getElementById('buddyFloat'); if(f) f.focus(); }catch(e){} if(typeof navSync==='function') navSync(); } } // 開いていた窓を閉じたときだけ焦点を浮動ボタンへ返す（起動時のリセットで焦点を奪わない）
