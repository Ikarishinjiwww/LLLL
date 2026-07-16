'use strict';
/* ---------- HOME (action hub) ---------- */
/* 様例先行門は終了。設計決定(2026-07-14):課切替=候補D(chip+行き先まで選べる浮き)、
 * 神経ホーム=案1(索引書)。他の候補と様板バーは削除した。 */
/* 様板バー:URL を打ち直さずに A/B/C/D と 1/2/3 をその場で切り替えて比べるための仮設 UI。
 * 案が確定したら、選ばれた 1 つを残してこのバーごと消す。 */

function renderHome(){
  registerFrame(renderHome,'home');
  clearCareTimer(); clearRunnerTimer();
  const m=App.course;
  const hasExam=examResumable();
  const pad=el('div',{class:'h2pad'});
  if(!lsGet(nk('helpSeen'),false)){
    /* 読む/さがす主体の課(神経)で「模擬試験を通しで」と言うのは製品として嘘。課の形で文案を分ける。 */
    const hintKey=(m.shape==='reader')?'firstHintReader':'firstHint';
    pad.appendChild(el('div',{class:'firsthint'},[ el('span',{class:'jp',text:t(hintKey)}),
      el('button',{text:'×',title:'OK',onclick:function(e){ lsSet(nk('helpSeen'),true); e.target.closest('.firsthint').remove(); }}) ]));
  }
  var a2=a2hsBannerNode(); if(a2) pad.appendChild(a2);
  /* コースの形(shape)で home を分ける。神経は問題が 11 問しかなく、読む/さがすが本体なので、
   * 臨床の「試験ハブ」をそのまま被せると製品として嘘になる。臨床の home は一切触らない。 */
  if(m && m.shape==='reader'){
    neuroHome(pad);
  }else{
    pad.appendChild(searchBarNode());
    pad.appendChild(homeHeroNode(hasExam));
    const tc=el('div',{class:'hometab',id:'homeTabContent'});
    tc.appendChild(App.homeTab==='review' ? reviewTabNode(hasExam) : examTabNode(hasExam));
    pad.appendChild(tc);
  }
  pad.appendChild(el('p',{class:'careline1b jp'},[ kaoWrap(pick(t('carePool'))) ])); // V1: ページ末尾の関懐ライン
  setView(el('div',{class:'home2'},[ pad ]),true);
}

/* ===================== 神経コースの home(3 案・実切替可) ===================== */
function neuroFacts(){
  if(App._nf && App._nfFor===App.course.id) return App._nf;
  let concepts=0, signals=0, caveats=0, compares=0, figs=0, slides=0;
  const units=manualUnits();
  const sigList=[], cavList=[];
  units.forEach(function(u){ (u.sections||[]).forEach(function(s){ (s.blocks||[]).forEach(function(b){
    if(b.type==='concept'){ concepts++;
      if(b.signal){ signals++; sigList.push({term:b.term,cardId:b.cardId,quote:b.signal.quote,kai:u.kai}); }
      if(b.caveat){ caveats++; cavList.push({term:b.term,cardId:b.cardId,exam:b.caveat.exam,kai:u.kai}); }
      if(b.figure&&b.figure.kind==='svg') figs++;
      if(b.figure&&b.figure.kind==='slideref') slides++;
    }
    if(b.type==='compare') compares++;
  }); }); });
  App._nf={units:units, concepts:concepts, signals:signals, caveats:caveats, compares:compares,
           figs:figs, slides:slides, sigList:sigList, cavList:cavList,
           questions:(App.questions||[]).length};
  App._nfFor=App.course.id;
  return App._nf;
}
function lastReadNode(){
  const ja=App.lang==='ja';
  const lr=lsGet(nk('lastRead'),null);
  if(!lr) return null;
  const ttl=kaiTitle(lr.kai)||('第'+lr.kai+'回');
  return el('button',{class:'nh-cont',onclick:function(){ renderReader(lr.kai,lr.sec||0); }},[
    el('span',{class:'nc-l jp',text:ja?'読みかけ':'读到一半'}),
    el('span',{class:'nc-t jp',text:'第'+lr.kai+'回 '+ttl}),
    el('span',{class:'nc-a',text:'›'})
  ]);
}
/* 大きな検索欄。神経では検索が主機能なので、飾りでなく本物の入力にして即打てる。 */
function bigSearchNode(){
  const ja=App.lang==='ja';
  const inp=el('input',{class:'nh-si jp',type:'text',
    placeholder:ja?'用語・かな・別名で引く(例: しさいぼう / EDA / 加算平均)':'按术语・假名・别名检索'});
  const go=function(){ renderSearch(inp.value||''); };
  inp.addEventListener('keydown',function(e){ if(e.key==='Enter') go(); });
  return el('div',{class:'nh-search'},[
    el('div',{class:'nh-srow'},[ svgNode(NEW_ICONS.search), inp,
      el('button',{class:'nh-sb jp',text:ja?'さがす':'检索',onclick:go}) ]),
    el('div',{class:'nh-shint jp',
      text:ja?'カタカナ/ひらがな・全角半角は同一視。スペース区切りで AND 検索。本文と対比表も引く。'
             :'片假名/平假名・全半角同视。空格分隔为 AND 检索。正文与对比表也在检索范围内。'})
  ]);
}
function kaiGridNode(compact){
  const f=neuroFacts();
  const grid=el('div',{class:'nh-kais'+(compact?' compact':'')});
  f.units.forEach(function(u){
    /* 「17概念 5対比」は数を誇るだけで、その回に何が出るのかは分からない。
     * その回のランドマークになる語を出す(図がある/問題に出た/対比表の主役/強調された語)。 */
    const kws=(u.keywords||[]).slice(0,4);
    grid.appendChild(el('button',{class:'nh-k',onclick:function(){ readerDir='fwd'; renderReader(u.kai,0); }},[
      el('span',{class:'nk-n',text:'第'+u.kai+'回'}),
      el('span',{class:'nk-t jp',text:kaiTitle(u.kai)||u.subtitle||''}),
      el('span',{class:'nk-kw'}, kws.map(function(k){ return el('em',{class:'jp',text:k}); }))
    ]));
  });
  return grid;
}
function caveatPanelNode(){
  const ja=App.lang==='ja', f=neuroFacts();
  if(!f.cavList.length) return null;
  const box=el('div',{class:'spanel nh-cav'});
  box.appendChild(el('div',{class:'sph'},[
    el('b',{class:'jp',text:ja?'レジュメの記述に注意':'讲义记述有问题'}),
    el('small',{class:'jp',text:f.caveats+(ja?' 件 · 試験で損をする箇所':' 条 · 考试会吃亏的地方')}) ]));
  f.cavList.forEach(function(c){
    box.appendChild(el('button',{class:'nh-cv',onclick:function(){ gotoCard(c.cardId,c.term); }},[
      el('span',{class:'cv-t jp',text:c.term}),
      el('span',{class:'cv-x jp',text:c.exam||''}),
      el('span',{class:'cv-k',text:'第'+c.kai+'回 ›'})
    ]));
  });
  return box;
}
function examStripNode(){
  const ja=App.lang==='ja', f=neuroFacts();
  return el('button',{class:'nh-exam',onclick:function(){ renderQuestionList(); }},[
    el('span',{class:'ne-t jp',text:ja?('授業で配られた問題（'+f.questions+'問）を見る'):('看课上发的练习题（'+f.questions+'题）')}),
    /* 「誤りを選べ」の数はデータから数える。文面に直書きすると問題が増えた時に嘘になる。 */
    el('span',{class:'ne-d jp',text:(function(){
      const n=(App.questions||[]).filter(function(q){return q.negative;}).length;
      if(!n) return ja?'授業で配られた過去問。':'本课发的过去题。';
      return ja?('そのうち '+n+' 問は「誤っているものを選べ」。正解がそのまま正しい文ではないので注意。')
               :('其中 '+n+' 题是「选出错误的一项」。正确选项本身是错误陈述，别记反。');
    })()}),
    el('span',{class:'ne-a',text:'›'})
  ]);
}
function neuroHome(pad){
  const ja=App.lang==='ja';
  /* 臨床と同じ入り方に揃える(設計決定):コース名の見出しではなく、挨拶 → 試験日ライン。
   * コース名は topbar の chip に出ているので、本文でもう一度名乗る必要がない。 */
  const left=daysUntilExam(), pace=suggestedPace();
  let subHtml;
  if(left!=null&&left>0){ subHtml=t('examIn').replace('{n}','<b>'+left+'</b>')+(pace?('・'+t('pace').replace('{n}','<b>'+pace+'</b>')):''); }
  else if(left!=null&&left<=0){ subHtml=t('examDay'); }
  else { subHtml=t('setExam')+' ›'; }
  pad.appendChild(el('div',{class:'nh-hd'},[
    el('div',{class:'greet1b jp'},kaoWrap(greetMsg())),
    el('button',{class:'greetsub jp',html:subHtml,onclick:openExamDate})
  ]));
  /* 索引書型:さがす → 読む。検索を主役に、回から潜る。
   * 数え上げのストリップ(240概念/35対比表…)は設計決定で撤去(自慢する場所ではない)。 */
  pad.appendChild(bigSearchNode());
  const lr=lastReadNode(); if(lr) pad.appendChild(lr);
  pad.appendChild(el('div',{class:'nh-sec jp',text:ja?'回から入る':'从回次进入'}));
  pad.appendChild(kaiGridNode(false));
  const cav=caveatPanelNode(); if(cav) pad.appendChild(cav);   /* 強調の引用一覧はホームから撤去(2026-07-15 決定)。強調はカード本文の中でだけ出す */
  pad.appendChild(examStripNode());
}


/* ---------- session model ---------- */
function quarantinedIds(){ const s=readExam(); return (s&&Array.isArray(s.ids))?s.ids:null; } // phase∈{answering,grading} 时才隔离
function isQuarantined(id){ const q=quarantinedIds(); return !!(q && q.indexOf(id)>=0); }
function toast(msg){ try{ const n=el('div',{class:'toast jp',text:msg}); document.body.appendChild(n); requestAnimationFrame(function(){ n.classList.add('in'); }); setTimeout(function(){ n.classList.remove('in'); setTimeout(function(){ if(n.parentNode) n.remove(); },300); },2600); }catch(e){} }
function newSession(mode,list,opts){
  if(mode!=='exam'){ const ql=quarantinedIds(); if(ql&&ql.length) list=list.filter(function(q){ return ql.indexOf(q.id)<0; }); }
  if(!list||!list.length){ toast(t('reviewEmptyExam')); return null; }
  App.session={ mode:mode, list:list, pos:0, opts:opts||{}, perItem:{}, results:[], streak:0, frontier:0, startAt:Date.now(), elapsedMs:0, runningSince:(mode!=='exam')?Date.now():0, answeredCount:0, lastCareElapsed:0, lastCareAnswered:0, recentWindow:[] };
  if(!(opts&&opts.from==='reader')) App.readerReturn=null; // 手册発以外の会話開始時は戻る先を破棄(旧 readerReturn の漏れ防止 → 模考等に誤って「戻る」が出ない)
  baseHome(); // 会话坐落在 [home, runner]: 退出/返回回首页
  clearCareTimer(); if(mode!=='exam') startCareTimer();
  return App.session;
}
function pushRecent(id){ App.recent.push(id); if(App.recent.length>40) App.recent.shift(); }

/* ===== mock-exam state machine (Brief 3): 盲答 answering → 批改 grading → 定稿 finalized ===== */
/* 内容指纹 (FNV-1a 32-bit): 题干 + 选项 + 评分点 + 模範解答; 恢复时逐题比对, 不符则整场作废 */
function fnv1a(str){ let h=0x811c9dc5; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,0x01000193); } return (h>>>0).toString(36); }
function contentFp(q){ const p=[q.q||'']; if(q.options) p.push(JSON.stringify(q.options)); if(q.rubric) p.push(JSON.stringify(q.rubric)); if(q.modelAnswer) p.push(JSON.stringify(q.modelAnswer)); return fnv1a(p.join('\u241F')); }
function examPerm(q){ return C.shuffleOptions(q.options.map(function(_,i){return i;}),App.rng); } // 冻结的原始下标排列 (持久化, 刷新可复原)
/* examInProgress 读写: iv=2 内部版本号(仅管此键); 仅 phase∈{answering,grading} 视为有效进行中 */
function readExam(){ const s=lsGet(nk('examInProgress'),null); if(!s||s.iv!==2) return null; if(s.phase!=='answering'&&s.phase!=='grading') return null; return s; }
function examResumable(){ return !!readExam(); }
function reconcileExam(){ const s=lsGet(nk('examInProgress'),null); if(s && s.iv!==2){ lsDel(nk('examInProgress')); } } // 旧格式硬作废(防陈旧隔离)
/* 计时: 累计在场时间 elapsedMs + 当前计时段起点 runningSince(暂停时为0) */
function examElapsed(){ const s=App.session; if(!s) return 0; return (s.elapsedMs||0)+(s.runningSince?(Date.now()-s.runningSince):0); }
function clockShouldRun(s){ return !!(s && ((s.mode==='exam' && s.phase==='answering') || s.mode!=='exam')); } // exam:仅答题阶段; 练习:整个 runner 期 (离页由 onVisibility 冻结 elapsed)
function pauseSessionClock(s){ if(s&&s.runningSince){ s.elapsedMs=(s.elapsedMs||0)+(Date.now()-s.runningSince); s.runningSince=0; if(s.mode==='exam') persistExam(); } }
function resumeSessionClock(s){ if(clockShouldRun(s) && !s.runningSince){ s.runningSince=Date.now(); } }
function onVisibility(){ const s=App.session; if(!s) return; if(document.hidden) pauseSessionClock(s); else resumeSessionClock(s); }

function startExam(){
  if(examResumable() && !confirm(t('examOverwriteConfirm'))) return; // 覆盖进行中的考试前确认
  const cfg=App.course.exam||{total:30,minSubjective:4,floatCount:1};
  const r=C.pickExamSet(App.questions,cfg,App.rng,App.recent);
  const s=newSession('exam',r.set,{shortfall:r.shortfall,counts:r.counts});
  if(!s) return;
  s.phase='answering'; s.elapsedMs=0; s.runningSince=Date.now();
  s.fp={}; s.list.forEach(function(q){ s.fp[q.id]=contentFp(q); });
  s.list.forEach(function(q){ const st=s.perItem[q.id]={ uncertain:false };
    if(q.type==='choice'){ st.perm=examPerm(q); st.picked=null; }
    else { st.raw=''; st.checked={}; st.evaluated=false; } });
  persistExam();
  renderRunner();
}
function serializePerItem(){ const s=App.session, o={};
  for(const id in s.perItem){ const p=s.perItem[id], e={ uncertain:!!p.uncertain };
    if(p.perm){ e.perm=p.perm; e.picked=(p.picked==null?null:p.picked); }
    else { e.raw=p.raw||''; e.checked=p.checked||{}; e.evaluated=!!p.evaluated; }
    o[id]=e; }
  return o;
}
function persistExam(){ const s=App.session; if(!s||s.mode!=='exam') return;
  lsSet(nk('examInProgress'),{ iv:2, phase:s.phase, ids:s.list.map(function(q){return q.id;}), pos:s.pos,
    elapsedMs:examElapsed(), fp:s.fp||{}, perItem:serializePerItem() });
}
function resumeExam(){
  const saved=readExam();
  if(!saved){ lsDel(nk('examInProgress')); toast(t('examInvalidated')); return renderHome(); }
  const list=saved.ids.map(function(id){ return App.idx.byId[id]; });
  let bad=list.some(function(q){ return !q; });
  if(!bad && saved.fp) bad=saved.ids.some(function(id){ const q=App.idx.byId[id]; return !q || contentFp(q)!==saved.fp[id]; });
  if(bad){ lsDel(nk('examInProgress')); toast(t('examInvalidated')); return renderHome(); } // 指纹失效: 整场作废
  const s=newSession('exam',list,{}); if(!s) return;
  s.phase=(saved.phase==='grading')?'grading':'answering';
  s.pos=Math.min(saved.pos||0,list.length-1); s.frontier=s.pos;
  s.elapsedMs=saved.elapsedMs||0; s.runningSince=(s.phase==='answering')?Date.now():0; s.fp=saved.fp||{};
  s.perItem={};
  list.forEach(function(q){ const sp=(saved.perItem&&saved.perItem[q.id])||{}, st=s.perItem[q.id]={ uncertain:!!sp.uncertain };
    if(q.type==='choice'){ st.perm=sp.perm||examPerm(q); st.picked=(sp.picked==null?null:sp.picked); }
    else { st.raw=sp.raw||''; st.checked=sp.checked||{}; st.evaluated=!!sp.evaluated; } });
  if(s.phase==='grading') renderGrading(); else renderRunner();
}

/* ---- 盲答阶段 (answering): 无判分 / 无解析 / 无概念入口; 仅选择与记入 + 不確かマーク ---- */
function renderExamAnswer(){
  const s=App.session, q=s.list[s.pos]; if(!q) return;
  const runner=el('div',{class:'runner exam-answer'});
  runner.appendChild(examNavStrip());
  const body=el('div',{class:'rbody'});
  const timerEl=el('span',{class:'qtimer'});
  body.appendChild(el('div',{class:'qhd'},[
    el('div',{class:'qhd-l'},[ sessionBackBtn(), el('div',{class:'crs jp'},[ el('span',{class:'qmode',text:modeLabel()}), el('b',{text:L(App.course.title)}) ]) ]),
    timerEl,
    el('button',{class:'qhome jp',text:t('home'),onclick:exitToHome})
  ]));
  body.appendChild(el('div',{class:'qnum'},[
    el('span',{class:'n',text:'Q.'+String(s.pos+1).padStart(2,'0')}),
    el('span',{class:'mode',text:typeLabel(q.type)}),
    qnumBookmarkBtn(q),
    el('span',{class:'prog',text:String(s.pos+1).padStart(2,'0')+' / '+s.list.length})
  ]));
  body.appendChild(el('div',{class:'qbar'},[ el('i',{style:'width:'+Math.round((s.pos+1)/s.list.length*100)+'%'}) ]));
  body.appendChild(qtextNode(q.q));
  const st=s.perItem[q.id]||(s.perItem[q.id]={uncertain:false});
  if(q.type==='choice') examChoiceBody(q,st,body); else examSubjectiveBody(q,st,body);
  body.appendChild(examUncertainToggle(q,st));
  body.appendChild(examAnswerNav());
  if(qStep!=='none'){ body.classList.add(qStep==='next'?'qstep-next':'qstep-prev'); qStep='none'; }
  runner.appendChild(body);
  registerFrame(renderRunner,'runner'); setView(runner);
  requestAnimationFrame(centerExamStrip); // レイアウト後に現在題を中央へ
  clearRunnerTimer(); startRunnerTimer(timerEl);
}
let examStripEl=null, examStripFor=null, examStripScroll=0; // 持久題号轨: 同一セッション内は再構築せず再利用しスクロール位置を維持 → 毎題リセット→smoothの「果凍」を根治
function examNavStrip(){ const s=App.session;
  if(examStripEl && examStripFor===s){ syncExamStrip(examStripEl); return examStripEl; } // 既存を再利用(scrollLeft維持); チップ状態のみ更新
  const strip=el('div',{class:'examstrip'});
  strip.appendChild(el('span',{class:'estrip-pad'})); // 先頭余白: 端の題も中央へ
  s.list.forEach(function(q,i){
    const chip=el('button',{class:'echip',text:String(i+1)});
    chip.addEventListener('click',function(){ if(i!==s.pos){ s.pos=i; persistExam(); qStep='none'; renderRunner(); } });
    strip.appendChild(chip); });
  strip.appendChild(el('span',{class:'estrip-pad'})); // 末尾余白
  examStripEl=strip; examStripFor=s; examStripScroll=0;
  syncExamStrip(strip); return strip;
}
function syncExamStrip(strip){ const s=App.session; if(!strip||!s) return; // チップの cur/done/unc を現状に同期(要素は使い回し)
  const chips=strip.querySelectorAll('.echip');
  s.list.forEach(function(q,i){ const st=s.perItem[q.id]||{}; const answered=(q.type==='choice')?(st.picked!=null):!!(st.raw&&st.raw.trim());
    const c=chips[i]; if(c) c.className='echip'+(i===s.pos?' cur':'')+(answered?' done':'')+(st.uncertain?' unc':''); });
}
function centerExamStrip(){ // 現在題を中央へ, 前位置から一格だけ滑らかにスクロール
  const strip=examStripEl; if(!strip||!strip.isConnected) return;
  const cur=strip.querySelector('.echip.cur'); if(!cur) return;
  const pad=Math.max(0, Math.round(strip.clientWidth/2 - cur.offsetWidth/2));
  strip.querySelectorAll('.estrip-pad').forEach(function(p){ if(p.style.width!==pad+'px') p.style.width=pad+'px'; });
  if(Math.abs(strip.scrollLeft-examStripScroll)>1) strip.scrollLeft=examStripScroll; // DOM移動でリセットされた位置を即復元 → smoothの起点を前回中央に
  const sr=strip.getBoundingClientRect(), cr=cur.getBoundingClientRect();
  const target=Math.max(0, Math.round(strip.scrollLeft + (cr.left-sr.left) - (strip.clientWidth/2 - cr.width/2)));
  const reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){ strip.scrollLeft=target; } else { strip.scrollTo({left:target, behavior:'smooth'}); }
  examStripScroll=target;
}
function examChoiceBody(q,st,body){ const wrap=el('div',{class:'opts'}); const perm=st.perm||(st.perm=examPerm(q));
  perm.forEach(function(oi,pi){ const o=q.options[oi], sel=(st.picked===oi);
    const btn=el('button',{class:'opt jp'+(sel?' sel':''),'aria-pressed':String(!!sel)},[ el('span',{class:'mk',text:'ABCDEF'[pi]||''}), el('span',{text:o.t}) ]);  /* B2: 選択状態を支援技術へ */
    btn.addEventListener('click',function(){ answerChoice(q,o); });
    wrap.appendChild(btn); });
  body.appendChild(wrap);
}
function examSubjectiveBody(q,st,body){ const wrap=el('div',{class:'ta-wrap'});
  const ta=el('textarea',{class:'answer jp',placeholder:(App.lang==='ja'?'ここに解答を記入':'在此作答'),rows:'5'});
  ta.value=st.raw||'';
  ta.addEventListener('input',function(){ st.raw=ta.value; });
  ta.addEventListener('change',function(){ persistExam(); });
  wrap.appendChild(ta); body.appendChild(wrap);
}
function examUncertainToggle(q,st){ const on=!!st.uncertain;
  const b=el('button',{class:'unc'+(on?' on':''),'aria-pressed':String(!!on)},[ el('span',{class:'mk',text:on?'✓':''}), el('span',{class:'jp',text:t('examUncertain')}) ]);  /* B2 */
  b.addEventListener('click',function(){ st.uncertain=!st.uncertain; persistExam(); renderRunner(); });
  return b;
}
function examAnswerNav(){ const s=App.session, row=el('div',{class:'examnav'});
  const prev=el('button',{class:'btn ghost',text:t('prev'),onclick:goPrev}); if(s.pos<=0) prev.disabled=true;
  const next=el('button',{class:'btn ghost',text:t('next'),onclick:goNext}); if(s.pos>=s.list.length-1) next.disabled=true;
  const submit=el('button',{class:'btn',text:t('examSubmit'),onclick:openSubmitCheck});
  row.appendChild(prev); row.appendChild(next); row.appendChild(submit);
  return row;
}
function openSubmitCheck(){ const s=App.session, unans=[], blank=[], unc=[];
  s.list.forEach(function(q,i){ const st=s.perItem[q.id]||{};
    if(q.type==='choice'){ if(st.picked==null) unans.push(i+1); } else { if(!(st.raw&&st.raw.trim())) blank.push(i+1); }
    if(st.uncertain) unc.push(i+1); });
  const body=[];
  if(!unans.length && !blank.length && !unc.length) body.push(el('p',{class:'jp',text:t('examAllDone')}));
  const mk=function(label,arr,warn){ if(!arr.length) return; body.push(el('div',{class:'chkline'+(warn?' warn':'')},[ el('div',{class:'cl-l jp',text:label}), el('div',{class:'cl-n',text:arr.join(', ')}) ])); };
  mk(t('examUnanswered'),unans,true); mk(t('examBlank'),blank,true); mk(t('examUncList'),unc,false);
  if(unans.length||blank.length) body.push(el('p',{class:'jp warn',style:'margin-top:10px',text:t('examWillWrong')}));
  body.push(el('div',{class:'row',style:'margin-top:14px;gap:10px'},[
    el('button',{class:'btn',text:t('examDoSubmit'),onclick:function(){ closeModal(); submitExam(); }}),
    el('button',{class:'btn ghost',text:t('back'),onclick:closeModal})
  ]));
  openModal(modalShell(t('examSubmitTitle'),body));
}
function submitExam(){ const s=App.session; if(!s||s.mode!=='exam') return;
  pauseSessionClock(s); clearRunnerTimer(); s.phase='grading'; persistExam();
  baseHome(); renderGrading();
}

/* ---- 批改阶段 (grading): 客观自动判 + 记述逐要点自评; 全部记述确定后方可定稿 ---- */
function explTiersNode(q){ // 解説 tiers: 簡短解説(常時) + 詳しい解説(折りたたみ); runner と 採点結果カードで共用
  const sx=LT(q.explainShort), lg=LT(q.explainLong);   /* B5: {ja:""} は「無し」 */
  if(!(sx||lg)) return null;
  const exw=el('div',{class:'exwrap'});
  if(sx) exw.appendChild(el('div',{class:'exblock short'},[ el('div',{class:'exhd',text:t('explain')}), richExplain(sx, qTerms(q)) ]));
  if(lg){
    const inner=el('div',{class:'exblock long'},[ el('div',{class:'exhd',text:t('exLong')}), richExplain(L(q.explainLong), qTerms(q)) ]);
    const block=el('div',{class:'excol'},[ el('div',{class:'excol-in'},[ inner ]) ]);
    const tog=el('button',{class:'exmore',text:t('detail')});
    tog.addEventListener('click',function(){ const open=block.getAttribute('data-open')==='true'; block.setAttribute('data-open',open?'false':'true'); tog.classList.toggle('open',!open); });
    exw.appendChild(tog); exw.appendChild(block);
  }
  return exw;
}
function renderGrading(){ const s=App.session; if(!s) return;
  clearRunnerTimer();
  let objCorrect=0,objTotal=0,subjTotal=0,subjEval=0;
  s.list.forEach(function(q){ const st=s.perItem[q.id]||{};
    if(q.type==='choice'){ objTotal++; if(C.gradeChoice(st.picked!=null?q.options[st.picked]:null)) objCorrect++; }
    else { subjTotal++; if(st.evaluated) subjEval++; } });
  const allEval=(subjEval===subjTotal);
  const wrap=el('div',{class:'grading'});
  wrap.appendChild(el('div',{class:'sechd'},[ el('h2',{class:'jp',text:t('gradingTitle')}), el('button',{class:'qhome jp',style:'margin-left:auto',text:t('home'),onclick:exitToHome}) ])); // 中断可(phase=grading 持久化 → 中断続行で復帰)
  wrap.appendChild(el('p',{class:'muted jp',text:t('gradingIntro')}));
  /* 上半区: 記述(自己採点・操作可) */
  if(subjTotal>0){ const sz=el('div',{class:'gzone subj'});
    sz.appendChild(el('div',{class:'gzhd jp'},[ el('span',{class:'gzt',text:typeLabel('subjective')}),
      el('span',{class:'gzp',text:t('gradingProgress').replace('{x}',subjEval).replace('{y}',subjTotal)}) ]));
    s.list.forEach(function(q,i){ if(q.type==='subjective') sz.appendChild(gradingCard(q,i)); });
    wrap.appendChild(sz); }
  /* 下半区: 客観(自動採点・読取専用); 全記述の採点確定まで結果を伏せる */
  if(objTotal>0){ const oz=el('div',{class:'gzone obj'});
    if(allEval){ oz.appendChild(el('div',{class:'gzhd jp'},[ el('span',{class:'gzt',text:typeLabel('choice')}),
        el('span',{class:'gzs',text:objCorrect+' / '+objTotal+' '+t('correct')}) ]));
      s.list.forEach(function(q,i){ if(q.type==='choice') oz.appendChild(gradingCard(q,i)); }); }
    else { oz.appendChild(el('div',{class:'gzlock jp'},[ el('span',{class:'gzt',text:typeLabel('choice')+'（'+objTotal+'）'}),
        el('p',{class:'gzlh',text:t('objHidden')}) ])); }
    wrap.appendChild(oz); }
  const foot=el('div',{class:'gradefoot'});
  foot.appendChild(el('div',{class:'gprog jp',text:t('gradingProgress').replace('{x}',subjEval).replace('{y}',subjTotal)}));
  const fin=el('button',{class:'btn',text:t('finalizeBtn'),onclick:finalizeExam}); if(!allEval){ fin.disabled=true; fin.title=t('finalizeLocked'); }
  foot.appendChild(fin); wrap.appendChild(foot);
  registerFrame(renderGrading,'examGrading'); setView(wrap);
}
function gradingCard(q,i){ const s=App.session, st=s.perItem[q.id]||{}, card=el('div',{class:'gcard'});
  card.appendChild(el('div',{class:'gqnum'},[ el('span',{class:'n',text:'Q.'+String(i+1).padStart(2,'0')}), el('span',{class:'mode',text:typeLabel(q.type)}) ]));
  card.appendChild(qtextNode(q.q));
  if(q.type==='choice'){
    const picked=(st.picked!=null)?q.options[st.picked]:null, correct=C.gradeChoice(picked);
    const opts=el('div',{class:'opts grading'}), perm=st.perm||q.options.map(function(_,k){return k;});
    perm.forEach(function(oi){ const o=q.options[oi], isP=(st.picked===oi), isC=!!o.correct;
      const cell=el('div',{class:'opt jp'+(isC?' ok':'')+(isP&&!isC?' no':'')},[ el('span',{class:'mk',text:isC?'✓':(isP?'✕':'')}), el('span',{text:o.t}) ]);
      if(isP) cell.appendChild(el('span',{class:'lbl',text:t('picked')}));
      opts.appendChild(cell); });
    card.appendChild(opts);
    if(st.picked==null) card.appendChild(el('div',{class:'gnote jp warn',text:t('examNoAnsWrong')}));
    card.appendChild(el('div',{class:'gres jp '+(correct?'ok':'no'),text:correct?t('correct'):t('wrong')}));
    const et=explTiersNode(q); // 客観題の解説: 既定=折りたたみ, 矢印で展開(採点画面で見直せる)
    if(et){
      const col=el('div',{class:'excol gexcol'},[ el('div',{class:'excol-in'},[ et ]) ]);
      const tog=el('button',{class:'exmore gexpl-tog',text:t('viewExpl')});
      tog.addEventListener('click',function(){ const open=col.getAttribute('data-open')==='true'; col.setAttribute('data-open',open?'false':'true'); tog.classList.toggle('open',!open); });
      card.appendChild(tog); card.appendChild(col);
    }
  } else {
    st.checked=st.checked||{};
    card.appendChild(el('div',{class:'ta-ro'},[ el('div',{class:'tl',text:t('yourAns')}), el('p',{text:(st.raw&&st.raw.trim())?st.raw:('('+t('examNoAns')+')')}) ]));
    card.appendChild(el('div',{class:'exblock model'},[ el('div',{class:'exhd',text:t('model')}), richExplain(L(q.modelAnswer), qTerms(q)) ]));
    card.appendChild(el('div',{class:'rubt jp',text:t('rubricHint')}));
    q.rubric.forEach(function(rb,k){ const on=!!st.checked[k];
      const row=el('button',{class:'rb'+(on?' hit':'')},[ el('span',{class:'ck',text:on?'✓':''}),
        el('div',null,[ el('div',{class:'rt jp',text:L(rb.point)}), el('span',{class:'rc',text:(on?('✓ '+t('hitConcept')):('○ '+t('missConcept')))+' · '+rb.concept}) ]) ]);
      row.addEventListener('click',function(){ const y=window.scrollY; st.checked[k]=!st.checked[k]; persistExam(); renderGrading(); window.scrollTo(0,y); });
      card.appendChild(row); });
    const total=q.rubric.length, hit=Object.keys(st.checked).filter(function(k){return st.checked[k];}).length;
    const pct=Math.round(C.subjectivePercent(hit,total)*100);
    const lvlKey=(hit===total)?'full':(hit===0?'none':'part'), lvlTxt=(hit===total)?t('masteryFull'):(hit===0?t('masteryNone'):t('masteryPart'));
    card.appendChild(el('div',{class:'scoreline jp'},[ el('span',{class:'lvl '+lvlKey,text:lvlTxt}), document.createTextNode('　'+pct+'%（'+total+t('ofPoints')+'中 '+hit+'）') ]));
    const evb=el('button',{class:'btn sm'+(st.evaluated?' ghost':''),style:'margin-top:10px',text:st.evaluated?t('gradeConfirmed'):t('gradeConfirm')});
    evb.addEventListener('click',function(){ const y=window.scrollY; st.evaluated=true; persistExam(); renderGrading(); window.scrollTo(0,y); });
    card.appendChild(evb);
  }
  return card;
}

/* ---- 定稿 (finalized): 一次性延迟批改写入 + exams++ + 单次落盘; 仅此处清键解除隔离 ---- */
function flushExamToProgress(){ const s=App.session;
  s.list.forEach(function(q){ const st=s.perItem[q.id]||{};
    if(q.type==='choice'){ const picked=(st.picked!=null)?q.options[st.picked]:null, correct=C.gradeChoice(picked);
      st.correct=correct; st.answered=true;
      recordAttempt(q,{type:'choice',correct:correct,ans:{selectedOption:picked}},{defer:true});
    } else { const total=q.rubric.length, checked=st.checked||{};
      const hit=Object.keys(checked).filter(function(k){return checked[k];}).length, missed=[];
      q.rubric.forEach(function(rb,k){ if(!checked[k]) missed.push(rb.concept); });
      st.correct=(hit===total); st.percent=C.subjectivePercent(hit,total); st.missed=missed; st.answered=true;
      recordAttempt(q,{type:'subjective',correct:st.correct,percent:st.percent,ans:{checkedConcepts:[],missedConcepts:missed},raw:st.raw},{defer:true});
    } });
  App.progress.stats.exams=(App.progress.stats.exams||0)+1;
  saveProgress(); // 单次落盘
}
function finalizeExam(){ const s=App.session; if(!s||s.mode!=='exam') return;
  const pending=s.list.some(function(q){ return q.type==='subjective' && !(s.perItem[q.id]&&s.perItem[q.id].evaluated); });
  if(pending){ toast(t('finalizeLocked')); return; }
  flushExamToProgress();
  lsDel(nk('examInProgress'));
  const log=[]; s.list.forEach(function(q){ const st=s.perItem[q.id]; log.push({ id:q.id, type:q.type, correct:st.correct, ans:{ missedConcepts:st.missed } }); });
  const agg=C.aggregateWeakness(log,App.idx.byId);
  saveExamHistory(s,agg); // 模試結果を履歴へ(回看用・PROGRESS とは別キーの追加保存)
  s.phase='finalized';
  baseHome(); App._bloom=false; renderResult(agg,s.list.length,s.list.length); showRestPop();
}

/* ---------- RUNNER ---------- */
const RENDER={ // 题型注册表(渲染侧); 未知 type 优雅跳过
  choice: renderChoiceBody,
  subjective: renderSubjectiveBody
};
const KEYS={ // 题型注册表(键盘侧); 走分发, 不写死两种, 未知 type 优雅跳过
  choice:{
    onDigit:function(q,n){ const s=App.session; const st=s.perItem[q.id]; if(!st) return false; if(s.mode==='exam'&&s.phase==='answering'){ const perm=st.perm; if(!perm||n>perm.length) return false; answerChoice(q,q.options[perm[n-1]]); return true; } if(st.answered) return false; const opts=st.order; if(!opts||n>opts.length) return false; answerChoice(q,opts[n-1]); return true; },
    onEnter:function(q){ const s=App.session; if(s.mode==='exam'&&s.phase==='answering'){ goNext(); return true; } const st=s.perItem[q.id]; if(st&&st.answered){ goNext(); return true; } return false; }
  },
  subjective:{
    onDigit:function(){ return false; }, // 记述题没有 1–4 选项: 不劫持、不崩溃
    onEnter:function(q){ const s=App.session; if(s.mode==='exam'&&s.phase==='answering'){ goNext(); return true; } const st=s.perItem[q.id]||(s.perItem[q.id]={}); if(!st.revealed){ st.revealed=true; st.checked=st.checked||{}; renderRunner(); return true; } goNext(); return true; }
  }
};
function onKey(e){
  if(e.key==='Escape'){ const root=document.getElementById('modalRoot'); if(root&&root.firstChild){ closeModal(); e.preventDefault(); return; }
    const mc=document.getElementById('meiChat'); if(mc&&mc.classList.contains('on')){ closeMeiChat(); e.preventDefault(); } return; } // F6: ダイアログなら Escape で閉じられるべき (modal が優先, 入力中でも効く位置)
  const tg=(e.target&&e.target.tagName||'').toLowerCase();
  if(tg==='textarea'||tg==='input'||tg==='select'||(e.target&&e.target.isContentEditable)) return; // 输入中不劫持数字/回车
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  if(!App.session || !document.querySelector('.runner')) return; // 仅在答题视图生效
  const q=App.session.list[App.session.pos]; if(!q) return;
  const h=KEYS[q.type]; if(!h) return; // 未知题型: 优雅跳过(不崩溃)
  if(/^[1-9]$/.test(e.key)){ if(h.onDigit && h.onDigit(q,parseInt(e.key,10))) e.preventDefault(); }
  else if(e.key==='Enter'){ if(h.onEnter && h.onEnter(q)) e.preventDefault(); }
  else if(e.key==='ArrowLeft'){ if(App.session.pos>0){ goPrev(); e.preventDefault(); } }
  else if(e.key==='ArrowRight'){ if(App.session.mode==='exam'&&App.session.phase==='answering'){ if(App.session.pos<App.session.list.length-1){ goNext(); e.preventDefault(); } return; } const st=App.session.perItem[q.id]; const ready=(q.type==='choice'?(st&&st.answered):(st&&st.revealed))||App.session.pos<(App.session.frontier||0); if(ready){ goNext(); e.preventDefault(); } }
}
function exitToHome(){ pauseSessionClock(App.session); clearCareTimer(); clearRunnerTimer(); App.session=null; App.readerReturn=null; goHome(); } // §5-9(b): 離脱前に時計を停止=累計確定(exam は persist)。答題視図を離れれば累計停止 // ホーム = 常に主頁(手册発でも誤解を避ける); 上一頁(reader)は「戻る」で
function backToReader(){ const r=App.readerReturn; if(!r) return exitToHome(); pauseSessionClock(App.session); App.readerReturn=null; App.session=null; clearCareTimer(); clearRunnerTimer();
  /* B1: newSession() が baseHome() でスタックを [home] に潰し、その上に runner が積まれる。
   * ここで reader を積むと [home, runner, reader] になり、次の「戻る」が session=null の runner を
   * 再生して画面が固まる(その状態で目次を押すと TypeError)。スタックを [home] に戻してから reader を積む。 */
  baseHome(); navDir='back';
  renderReader(r.kai,r.sec); }
function sessionBackBtn(){ return App.readerReturn ? el('button',{class:'qback jp',html:'‹ '+t('back'),onclick:backToReader}) : null; } // 手册発 session のみ左上に「戻る」
function renderRunner(){
  const s=App.session;
  if(!s){
    /* B1 保険: 死んだ runner フレームが再生された時だけ、そのフレームを畳んでさらに戻る。
     * (直接呼ばれただけの時にホームへ飛ばすと、隔離で会話が作れなかった場合に画面が勝手に家へ帰る) */
    const top=viewStack[viewStack.length-1];
    if(top && top.key==='runner'){ viewStack.pop(); return goBack(); }
    return;
  }
  if(s.mode==='exam' && s.phase==='answering') return renderExamAnswer();
  const q=s.list[s.pos];
  if(!q){ return finishSession(); }
  const renderer=RENDER[q.type];
  const fromReader=!!(s.opts && s.opts.from==='reader'); // 手册発の演習は単一回 → 回レール(回1-12指示)が無意味なので外し, 全幅 + 戻るを真の左上へ
  const runner=el('div',{class:'runner'+(fromReader?' no-rail':'')});
  if(!fromReader) runner.appendChild(buildRail(q));
  const body=el('div',{class:'rbody'});
  // chrome
  const timerEl=(s.mode==='exam')?el('span',{class:'qtimer'}):null;
  body.appendChild(el('div',{class:'qhd'},[
    el('div',{class:'qhd-l'},[ sessionBackBtn(), el('div',{class:'crs jp'},[ el('span',{class:'qmode',text:modeLabel()}), el('b',{text:L(App.course.title)}) ]) ]),
    timerEl,
    el('button',{class:'qhome jp',text:t('home'),onclick:exitToHome})
  ]));
  body.appendChild(el('div',{class:'qnum'},[
    el('span',{class:'n',text:'Q.'+String(s.pos+1).padStart(2,'0')}),
    el('span',{class:'mode',text:typeLabel(q.type)}),
    qnumBookmarkBtn(q),
    el('span',{class:'prog',text:String(s.pos+1).padStart(2,'0')+' / '+s.list.length})
  ]));
  body.appendChild(el('div',{class:'qbar'},[ el('i',{style:'width:'+Math.round((s.pos+1)/s.list.length*100)+'%'}) ]));
  body.appendChild(qtextNode(q.q));
  if(renderer){ renderer(q,body,s.pos<(s.frontier||0)); }
  else { // 未知题型: 优雅降级
    if(App.dev) console.warn('未知 type, 跳过渲染:',q.type);
    body.appendChild(el('p',{class:'muted',text:'(unsupported question type: '+q.type+')'}));
    body.appendChild(el('button',{class:'btn sm',style:'margin-top:12px',text:t('next'),onclick:goNext}));
  }
  if(qStep!=='none'){ body.classList.add(qStep==='next'?'qstep-next':'qstep-prev'); qStep='none'; }
  runner.appendChild(body);
  registerFrame(renderRunner,'runner'); // 先注册帧(定方向), 再 setView(套动画)
  setView(runner);
  clearRunnerTimer();
  if(timerEl) startRunnerTimer(timerEl);
}
function modeLabel(){ const m=App.session.mode; return m==='exam'?t('modeExam'):m==='wrong'?t('modeWrong'):m==='weak'?t('modeWeak'):t('modeReview'); }
function typeLabel(type){ return type==='subjective'?(App.lang==='ja'?'記述式':'记述题'):(App.lang==='ja'?'選択式':'选择题'); }

function buildRail(currentQ){
  const rail=el('div',{class:'rail'},[ el('div',{class:'rk',text:'回'}) ]);
  App.idx.kais.forEach(function(kai){
    const ids=App.idx.kaiToQuestions[kai]||[];
    const allSeen=ids.length>0 && ids.every(id=>App.progress.seen[id]);
    const tab=el('div',{class:'tab'+(kai===currentQ.kai?' on':''),text:String(kai)});
    if(allSeen) tab.appendChild(el('span',{class:'done',text:'✓'}));
    rail.appendChild(tab); // 答題中は現在地の表示のみ（クリック不可）
  });
  return rail;
}

/* choice */
function renderChoiceBody(q,body){
  const s=App.session; const st=s.perItem[q.id]||(s.perItem[q.id]={});
  const opts = st.order || (st.order=C.shuffleOptions(q.options,App.rng));
  const optsWrap=el('div',{class:'opts'});
  opts.forEach(function(o,oi){
    const btn=el('button',{class:'opt jp','aria-pressed':String(st&&st.picked===o)},[ el('span',{class:'mk',text:'ABCDEF'[oi]||''}), el('span',{text:o.t}) ]);  /* B2 */
    if(st.answered){
      btn.disabled=true;
      if(o.correct){ btn.classList.add('ok'); btn.appendChild(el('span',{class:'lbl',text:t('correct')})); }
      else if(st.picked===o){ btn.classList.add('no'); btn.appendChild(el('span',{class:'lbl',text:t('wrong')+t('picked')})); }
    } else {
      btn.addEventListener('click',function(){ answerChoice(q,o); });
    }
    optsWrap.appendChild(btn);
  });
  body.appendChild(optsWrap);
  if(st.answered){
    if(s._pulse && s._pulse.id===q.id){ const tgt=s._pulse.kind==='ok'?optsWrap.querySelector('.opt.ok'):optsWrap.querySelector('.opt.no'); if(tgt) tgt.classList.add(s._pulse.kind==='ok'?'settle':'nudge'); s._pulse=null; }
    body.appendChild(buildReveal(q,false));
  }
}
function answerChoice(q,o){
  const s=App.session;
  if(s.mode==='exam' && s.phase==='answering'){ const est=s.perItem[q.id]||(s.perItem[q.id]={uncertain:false}); const oi=q.options.indexOf(o); est.picked=(est.picked===oi)?null:oi; persistExam(); renderRunner(); return; }
  const st=s.perItem[q.id];
  const correct=C.gradeChoice(o);
  st.answered=true; st.picked=o; st.correct=correct;
  s.streak = correct ? ((s.streak||0)+1) : 0;
  s.answeredCount=(s.answeredCount||0)+1; s.recentWindow=s.recentWindow||[]; s.recentWindow.push(!!correct); if(s.recentWindow.length>8) s.recentWindow.shift(); // care:里程碑 + 错误聚集窗
  recordAttempt(q,{type:'choice',correct:correct,ans:{selectedOption:o}});
  pushRecent(q.id);
  if(s.mode!=='exam') s._pulse={id:q.id,kind:correct?'ok':'no'}; // 练习即时反馈; 模考不置
  if(s.mode==='exam') persistExam();
  keepScroll=true; renderRunner(); // 练习揭示就地展开 → 保位不滚顶 (修「滚动后点选项」顶栏闪 + 不跳回顶部)
}

/* subjective */
function renderSubjectiveBody(q,body,readOnly){
  const s=App.session; const st=s.perItem[q.id]||(s.perItem[q.id]={});
  if(!st.revealed && !readOnly){
    const wrap=el('div',{class:'ta-wrap'});
    const ta=el('textarea',{class:'answer jp',placeholder:App.lang==='ja'?'ここに自分の解答を書いてから「答え合わせ」':'先在这里写下你的解答，再「对答案」'});
    ta.value=st.raw||'';
    ta.addEventListener('input',()=>{ st.raw=ta.value; });
    wrap.appendChild(ta);
    body.appendChild(wrap);
    body.appendChild(el('button',{class:'btn',text:t('reveal'),onclick:function(){ st.revealed=true; st.raw=ta.value; st.checked=st.checked||{}; if(s.mode!=='exam'){ s.answeredCount=(s.answeredCount||0)+1; } keepScroll=true; renderRunner(); }}));
    return;
  }
  // revealed
  if(st.raw && st.raw.trim()) body.appendChild(el('div',{class:'ta-ro'},[ el('div',{class:'tl',text:t('yourAns')}), el('p',{text:st.raw}) ]));
  body.appendChild(el('div',{class:'exblock model',style:'margin-top:6px'},[ el('div',{class:'exhd',text:t('model')}), richExplain(L(q.modelAnswer), qTerms(q)) ]));
  body.appendChild(el('div',{class:'rubt jp',text:t('rubricHint')}));
  st.checked=st.checked||{};
  q.rubric.forEach(function(rb,i){
    const on=!!st.checked[i];
    const row=el('button',{class:'rb'+(on?' hit':'')},[
      el('span',{class:'ck',text:on?'✓':''}),
      el('div',null,[ el('div',{class:'rt jp',text:L(rb.point)}),
        el('span',{class:'rc',text:(on?'✓ '+t('hitConcept'):'○ '+t('missConcept'))+' · '+rb.concept}) ])
    ]);
    if(!readOnly) row.addEventListener('click',function(){ const y=window.scrollY; st.checked[i]=!st.checked[i]; commitSubjective(q); renderRunner(); window.scrollTo(0,y); });
    body.appendChild(row);
  });
  const total=q.rubric.length, hit=Object.values(st.checked).filter(Boolean).length;
  const pct=Math.round(C.subjectivePercent(hit,total)*100);
  body.appendChild(el('div',{class:'scoreline jp'},[ document.createTextNode(t('achieve')+'  '), el('b',{text:pct+'%'}), document.createTextNode('  （'+total+t('ofPoints')+'中 '+hit+'）') ]));
  body.appendChild(buildReveal(q,false));
}
function commitSubjective(q){
  const s=App.session; const st=s.perItem[q.id];
  const total=q.rubric.length, hit=Object.values(st.checked).filter(Boolean).length;
  const missed=[]; q.rubric.forEach((rb,i)=>{ if(!st.checked[i]) missed.push(rb.concept); });
  st.percent=C.subjectivePercent(hit,total); st.missed=missed; st.correct=(hit===total); st.answered=true;
  recordAttempt(q,{type:'subjective',correct:st.correct,percent:st.percent,ans:{checkedConcepts:[],missedConcepts:missed},raw:st.raw});
  pushRecent(q.id);
  if(s.mode==='exam') persistExam();
}

/* reveal layer (breadcrumb + tags + explain + provenance) */
function pick(arr){ return (Array.isArray(arr)&&arr.length)?arr[Math.floor(Math.random()*arr.length)]:''; }
function greetMsg(){ const p=t('greetPool'); return (Array.isArray(p)&&p.length)?pick(p):t('greet'); } // §5-4/8: 挨拶を単条→池からランダム
/* 颜文字换行保护: 把颜文字整体包进 .kao{white-space:nowrap}, 避免 CJK 逐字断行把颜文字劈成两半(如问候大标题). 未命中则原样返回纯文本节点(优雅降级) */
var KAOS=['( ˘▽˘ )','( ˘ω˘ )','(๑•ω•๑)','(｡•ω•｡)','(〃ω〃)','(〃▽〃)','( ˘ω˘ )♡','(｡•ω•｡)♡','(๑>◡<๑)','٩(^‿^)۶','(♡ >ω< ♡)','(｡♡‿♡｡)','( ˘ ³˘)♥','( ˘ ³˘ )','(っ˘ω˘ς )','(｡･ω･｡)','(=^･ω･^=)','(=^･ｪ･^=)','♪( ˘▽˘ )','(≧◡≦)','(^▽^)','(^ω^)','(^◇^)','o(^▽^)o','o(≧▽≦)o','ヾ(≧▽≦*)o','(((o(*ﾟ▽ﾟ*)o)))','٩(♡ε♡ )۶','٩(^ω^)۶','＼(^o^)／','(´▽｀)','♪(´▽｀)','(´ω｀)','(o´∀`o)','(*´ω｀*)','(´ε｀ )♡','(❁´◡`❁)','(๑❛ᴗ❛๑)','( ᵕᴗᵕ )','(ღ˘⌣˘ღ)','(ෆ˙ᵕ˙ෆ)','୧(๑•̀⌄•́๑)૭','(♡´▽`♡)','☆〜（ゝ。∂）','ฅ^•ﻌ•^ฅ'].sort(function(a,b){return b.length-a.length;});
var KAO_RE=new RegExp(KAOS.map(function(k){return k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|'),'g');
function kaoWrap(str){ if(!str) return document.createTextNode(str||'');
  var frag=document.createDocumentFragment(), last=0, m, hit=false; KAO_RE.lastIndex=0;
  while((m=KAO_RE.exec(str))){ hit=true;
    if(m.index>last) frag.appendChild(document.createTextNode(str.slice(last,m.index)));
    frag.appendChild(el('span',{class:'kao',text:m[0]})); last=m.index+m[0].length; }
  if(!hit) return document.createTextNode(str);
  if(last<str.length) frag.appendChild(document.createTextNode(str.slice(last)));
  return frag; }
function qnumBookmarkBtn(q){ // 做题中随时收藏（模試盲答期も可・判分に無関係な純マーカー）
  const on=!!getBookmarks()[q.id];
  const b=el('button',{class:'qbm'+(on?' on':''),title:t('bookmark'),'aria-label':t('bookmark'),'aria-pressed':String(on),html:NEW_ICONS.star});
  b.addEventListener('click',function(){ const now=toggleBookmark(q.id); b.classList.toggle('on',now); b.setAttribute('aria-pressed',String(now)); });
  return b;
}
function feedbackNode(q){ // 做对鼓励 / 做错安慰 / 连对更高奖励（仅选择题, 对错清晰）
  if(!App.session || q.type!=='choice') return null;
  const st=App.session.perItem[q.id]; if(!st||!st.answered) return null;
  let msg, tone;
  if(st.correct){
    const streak=App.session.streak||0;
    if(streak>=5){ msg=pick(t('encStreakHi')).replace('{n}',streak); tone='hi'; }
    else if(streak>=3){ msg=pick(t('encStreak')).replace('{n}',streak); tone='hi'; }
    else { msg=pick(t('encCorrect')); tone='ok'; }
  } else { msg=pick(t('encWrong')); tone='no'; }
  return el('div',{class:'fbk '+tone},[ el('span',{class:'jp'},[kaoWrap(msg)]) ]);
}
/* 由来トレイルの概念 → 資料集(リーダー)の該当節を解決。手册未搭載/該当回なしは null(旧来の概念ページへ fallback)。§7.10 の節番号ズレは番号プレフィックスで吸収。 */
function conceptReaderTarget(name){
  const meta=App.idx.conceptMeta[name];
  if(!(meta&&meta.exists&&meta.origin)) return null;
  const kai=meta.origin.kai;
  const unit=(App.manual&&App.manual.units)?App.manual.units.find(function(u){return u.kai===kai;}):null;
  if(!(unit&&unit.sections&&unit.sections.length)) return null;
  const osec=meta.origin.section||'';
  const np=function(s){ const m=/(\d+\.\d+)/.exec(s||''); return m?m[1]:null; };
  let idx=unit.sections.findIndex(function(s){ return s.source&&s.source.section===osec; });
  if(idx<0){ const p=np(osec); if(p) idx=unit.sections.findIndex(function(s){ return np(s.source&&s.source.section)===p; }); }
  return {kai:kai,sec:idx>=0?idx+1:0}; // 節命中→その節(扉=0 の次から), 未命中→扉
}
function buildReveal(q,noAnim){
  const wrap=el('div',{class:'reveal'+(noAnim?'':' anim')});
  const fb=feedbackNode(q); if(fb) wrap.appendChild(fb);
  wrap.appendChild(el('div',{class:'revcap',text:t('afterReveal')}));
  // breadcrumb: 課程 › 回x section › topic › concept
  const crumb=el('div',{class:'crumb'},[ el('span',{class:'jp2',text:App.lang==='ja'?'コース':'课程'}), el('span',{class:'sep',text:'›'}),
    el('b',{text:'回'+q.source.kai}), el('span',{class:'jp2',text:(q.source.section||'')}) ]);
  if(q.topic){ crumb.appendChild(el('span',{class:'sep',text:'›'})); crumb.appendChild(el('span',{class:'jp2',text:q.topic})); }
  if(q.concepts&&q.concepts[0]){ crumb.appendChild(el('span',{class:'sep',text:'›'})); crumb.appendChild(el('b',{text:q.concepts[0]})); }
  wrap.appendChild(crumb);
  wrap.appendChild(el('div',{class:'tags'},[ el('span',{class:'tag kind',text:q.kind}), q.topic?el('span',{class:'tag',text:q.topic}):null ]));
  // explanation tiers(runner): explTiersNode で組み立て(採点結果カードと共用)
  { const _et=explTiersNode(q); if(_et) wrap.appendChild(_et); }
  // provenance trail
  const cs=[]; (q.concepts||[]).forEach(c=>cs.push(c)); (q.rubric||[]).forEach(rb=>{ if(rb.concept&&cs.indexOf(rb.concept)<0) cs.push(rb.concept); });
  if(cs.length){
    const trail=el('div',{class:'trail'},[ el('div',{class:'tt',text:t('origin')}) ]);
    cs.forEach(function(c){
      const meta=App.idx.conceptMeta[c];
      const step=el('div',{class:'step'},[ el('span',{class:'dot'}) ]);
      if(meta&&meta.exists){
        const nm=el('button',{class:'cn jp',style:'background:none;border:none;padding:0;cursor:pointer;text-align:left',text:c});
        nm.addEventListener('click',function(){ const tg=conceptReaderTarget(c); if(tg) renderReader(tg.kai,tg.sec); else renderConcept(c,{from:'runner'}); }); // 由来 → 資料集(復習手册)の該当節へ。手册外の概念のみ旧概念ページへ fallback
        step.appendChild(nm);
        step.appendChild(el('span',{class:'og',text:'回'+meta.origin.kai+' · '+(meta.origin.section||'').split(' ')[0]}));
      } else {
        step.appendChild(el('span',{class:'cn jp dis',text:c, title:t('conceptMissing')}));
      }
      trail.appendChild(step);
    });
    wrap.appendChild(trail);
  }
  const bmOn=isBookmarked(q.id);
  const bm=el('button',{class:'bmstar'+(bmOn?' on':''),style:'margin-top:14px'},[ svgNode(NEW_ICONS.star), el('span',{class:'jp',text:bmOn?t('booked'):t('bookmark')}) ]);
  bm.addEventListener('click',function(){ const now=toggleBookmark(q.id); bm.classList.toggle('on',now); bm.querySelector('span:last-child').textContent=now?t('booked'):t('bookmark'); });
  wrap.appendChild(bm);
  wrap.appendChild(navRowNode());
  return wrap;
}
function goNext(){
  const s=App.session;
  if(s.mode==='exam'){ if(s.pos<s.list.length-1){ s.pos++; if(s.frontier==null||s.pos>s.frontier) s.frontier=s.pos; persistExam(); qStep='next'; renderRunner(); } return; }
  const np=s.pos+1; if(np>(s.frontier||0)) s.frontier=np;
  if(s.pos<s.list.length-1){ s.pos=np; qStep='next'; renderRunner(); }
  else finishSession();
}
function goPrev(){ const s=App.session; if(s.pos>0){ s.pos--; if(s.mode==='exam') persistExam(); qStep='prev'; renderRunner(); } }

/* ---------- record attempt -> progress (seen/wrong/weakness/attempts) ---------- */
function recordAttempt(q,info,opt){
  App.progress.seen[q.id]=true;
  const wasWrong = info.correct!==true;
  if(wasWrong) App.progress.wrong[q.id]=true; else delete App.progress.wrong[q.id];
  // weakness via core extractor
  const h=C.types[q.type];
  if(h){ const cs=h.weaknessExtract(q,info.ans,info.correct)||[]; cs.forEach(c=>{ App.progress.weakness[c]=(App.progress.weakness[c]||0)+1; }); }
  App.progress.attempts.push({id:q.id,type:q.type,correct:info.correct,percent:info.percent,at:Date.now(),
    missedConcepts:info.ans&&info.ans.missedConcepts, rawAnswer:info.raw});
  if(App.progress.attempts.length>2000) App.progress.attempts.splice(0,App.progress.attempts.length-2000);
  if(!(opt&&opt.defer)) saveProgress();
}

/* ---------- finish session -> result ---------- */
function finishSession(){
  clearCareTimer(); clearRunnerTimer();
  const s=App.session;
  const log=[]; s.list.forEach(function(q){ const st=s.perItem[q.id]; if(st&&st.answered){
    log.push({id:q.id,type:q.type,correct:st.correct,ans:{missedConcepts:st.missed}}); } });
  const agg=C.aggregateWeakness(log,App.idx.byId);
  if(s.mode==='exam'){ App.progress.stats.exams=(App.progress.stats.exams||0)+1; saveProgress(); lsDel(nk('examInProgress')); }
  baseHome(); // 结果坐落在 [home, result]: 返回回首页(无法退回已结束的答题)
  if(s.mode!=='exam') App._bloom=true; // 练习结果径向; 模考安静
  renderResult(agg,log.length,s.list.length);
  showRestPop();
}
function renderResult(agg,answered,total){
  registerFrame(function(){ renderResult(agg,answered,total); },'result');
  const correct=agg.totals.correct, pct=total?Math.round(correct/total*100):0; // 分母=セッション全題数(表示と計分の意味統一)
  const kids=[];
  const card=el('div',{class:'card'});
  card.appendChild(el('div',{class:'donekao jp'},[ kaoWrap(pct>=80?'＼(^o^)／':(pct>=50?'( ˘▽˘ )':'( ˘ω˘ )')) ])); // 顔も点数に同調(低分に♡は情緒不一致)
  card.appendChild(el('h2',{class:'donet jp',text:t('sessionDone')})); // 標題=ねぎらいに固定(模式名は副行のみ→重複解消)
  card.appendChild(el('div',{class:'dsub1 jp',text:t('resSub').replace('{m}',App.session.mode==='exam'?t('modeExam'):t('modeReview')).replace('{n}',total)}));
  const bloom=App._bloom; App._bloom=false; // 一次性消费: 语言重放/返回结果页不重播
  card.appendChild(el('div',{class:'bigscore'+(bloom?' bloom':'')},[ el('span',{class:'pct',text:pct+'%'}),
    el('span',{class:'frac jp',text:t('resFract').replace('{a}',total).replace('{b}',correct)}) ]));
  if(App.session.mode==='exam'){ card.appendChild(el('div',{class:'examtime jp',text:t('examTime')+'　'+fmtDuration(examElapsed()/1000)})); }
  const cw=topEntries(agg.concepts,8).map(function(e){ return e[0]; });
  card.appendChild(el('div',{class:'encore jp'},[ kaoWrap(pick(pct<50?t('encWrong'):t('carePool'))) ])); // 低分=安撫(encWrong)·常分=関懐
  if(cw.length){
    card.appendChild(el('div',{class:'rubt jp',style:'margin-top:14px',text:t('actWeak')}));
    const chips=el('div',{class:'weakchips1'});
    cw.slice(0,6).forEach(function(nm){ chips.appendChild(el('button',{class:'wkchip jp',text:nm,onclick:function(){ renderConcept(nm,{from:'result'}); }})); });
    card.appendChild(chips);
  }
  // AI guidance (slim: hint + export; full prompt is written into the downloaded file)
  card.appendChild(buildAIGuidance());
  // (rest reminder is now a transient overlay shown on finishing a set ― see showRestPop)
  // actions
  const acts=el('div',{class:'racts1'});
  if(App.session.mode==='exam') acts.appendChild(el('button',{class:'btn',text:t('again'),onclick:startExam}));
  if(App.session.mode==='exam') acts.appendChild(el('button',{class:'btn ghost',text:t('histTitle'),onclick:renderExamHistory}));
  if(cw.length) acts.appendChild(el('button',{class:'btn ghost',text:t('weighted'),onclick:startWeighted}));
  if(App.readerReturn) acts.appendChild(el('button',{class:'btn',text:t('back'),onclick:backToReader}));
  acts.appendChild(el('button',{class:'btn ghost',text:t('home'),onclick:exitToHome}));
  card.appendChild(acts);
  card.appendChild(el('div',{class:'fbkcontact jp',text:t('feedback')}));
  kids.push(card);
  setView(el('div',null,kids));
}
function statBox(n,l){ return el('div',{class:'statbox'},[ el('div',{class:'n',text:String(n)}), el('div',{class:'l jp',text:l}) ]); }
function distBar(label,v,max){ return el('div',{class:'weakrow'},[
  el('span',{class:'jp',style:'font-size:12.5px;min-width:64px;color:var(--ink)',text:label}),
  el('div',{class:'barbg'},[ el('div',{class:'barfg',style:'width:'+Math.round(v/max*100)+'%;background:var(--no)'}) ]),
  el('span',{class:'mono',style:'font-size:11px;color:var(--soft)',text:String(v)}) ]); }
function topEntries(obj,n){ return Object.entries(obj||{}).sort((a,b)=>b[1]-a[1]).slice(0,n); }
function maxVal(obj){ const vs=Object.values(obj||{}); return vs.length?Math.max.apply(null,vs):1; }

function buildAIGuidance(){
  const box=el('div',{class:'aibox'},[ el('div',{class:'et',text:t('aiTitle')}), el('p',{class:'jp',text:t('aiResultHint')}) ]);
  const expBtn=el('button',{class:'btn sm',text:t('export')});
  expBtn.addEventListener('click',openIO);
  box.appendChild(el('div',{class:'row'},[ expBtn ]));
  return box;
}
/* ---------- rest overlay (transient, never blocks input) §4.4 ---------- */
const REST_ICONS=[
  // 七项⑤ Lucide 换代: 由手绘 46×46/stroke2.4/暖色#9E4631 → Lucide 24-grid/currentColor/1.75(与全库图标同族同权重)。coffee
  '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2M10 2v2M14 2v2"/></svg>',
  // cat
  '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z"/><path d="M8 14v.5M16 14v.5"/><path d="M11.25 16.25h1.5L12 17z"/></svg>',
  // mountain-snow (ひと休みの風景)
  '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/><path d="M4.14 15.08c2.62-1.57 5.24-1.57 7.86 0 2.62 1.57 5.24 1.57 7.86 0"/></svg>'
];
let restTick=0;
function showRestPop(){
  try{
    const msg=pick(t('restPool')); const icon=pick(REST_ICONS); restTick++; // §5-4: 每回 pick 真随机(旧: restTick 顺送り→初回が必ず restPool[0]「珈琲」に固定される不具合)
    const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rp=el('div',{class:'rp'},[ el('div',{class:'rpic',style:'display:flex;justify-content:center;line-height:0',html:icon}), el('div',{class:'rpt'},[kaoWrap(msg)]) ]);
    const pop=el('div',{class:'restpop'+(reduce?'':' anim')},[ rp ]);
    document.body.appendChild(pop);
    const ttl=reduce?1600:2900;
    setTimeout(function(){ if(pop&&pop.parentNode) pop.parentNode.removeChild(pop); },ttl);
  }catch(e){ /* 休息提示失败不应影响主流程 */ }
}

function startReviewKai(kai){
  const ids=App.idx.kaiToQuestions[kai]||[];
  const list=C.reviewSample(App.questions,{onlyIds:ids,count:ids.length,recentIds:App.recent},App.rng);
  newSession('review',list,{kai:kai}); renderRunner();
}
function startWeighted(n){ // n 指定時(圆窗「10問」チップ)は題数を守約: 苦手在庫が薄ければ全体から不足分を補充
  const want=(n||12);
  let list=C.reviewSample(App.questions,{weakness:App.progress.weakness,count:want,recentIds:App.recent},App.rng);
  if(n && list.length<want){
    const have={}; list.forEach(function(q){ have[q.id]=1; });
    const pad=C.reviewSample(App.questions,{count:want+8,recentIds:App.recent},App.rng)
      .filter(function(q){ return !have[q.id]; }).slice(0, want-list.length);
    list=list.concat(pad);
  }
  newSession('weak',list,{}); renderRunner();
}
function startRandom(){
  const list=C.reviewSample(App.questions,{count:12,recentIds:App.recent},App.rng);
  newSession('review',list,{}); renderRunner();
}

/* ---------- WRONG + WEAK merged hub (v1.6.0): 間違い + 苦手 を一つの枢に, 分段切替, 両視図の内容は原様流用 ---------- */
function wrongBodyNodes(){ // 「間違い」子視図の本体 (旧 renderWrong 本体; sectionHead/registerFrame/setView を除く, 内容不変)
  const ids=Object.keys(App.progress.wrong);
  if(!ids.length){ return [ el('div',{class:'card'},[ el('p',{class:'muted jp',text:t('wrongNone')}) ]) ]; }
  const out=[];
  const top=el('div',{class:'card'},[ el('p',{class:'muted jp',text:ids.length+' '+t('q')}) ]);
  top.appendChild(el('button',{class:'btn',style:'margin-top:10px',text:t('startReview'),onclick:function(){
    const list=C.reviewSample(App.questions,{onlyIds:ids,count:Math.min(ids.length,20),weakness:App.progress.weakness,recentIds:App.recent},App.rng);
    newSession('wrong',list,{}); renderRunner();
  }}));
  out.push(top);
  const groups={};
  ids.forEach(function(id){ const q=App.idx.byId[id]; if(!q) return; const cs=new Set();
    (q.concepts||[]).forEach(function(c){ cs.add(c); }); (q.rubric||[]).forEach(function(rb){ if(rb.concept) cs.add(rb.concept); });
    if(!cs.size) cs.add(App.lang==='ja'?'その他':'其他'); cs.forEach(function(c){ (groups[c]=groups[c]||[]).push(id); }); });
  const ordered=Object.entries(groups).sort(function(a,b){ return b[1].length-a[1].length; });
  const card=el('div',{class:'card'});
  card.appendChild(el('div',{class:'rubt jp',text:t('wrongByConcept')}));
  ordered.forEach(function(pair){ const c=pair[0], gids=pair[1];
    card.appendChild(el('div',{class:'wgrp'},[
      el('button',{class:'wgrp-n jp',text:c,title:c,onclick:function(){ if(App.idx.conceptMeta[c]&&App.idx.conceptMeta[c].exists) renderConcept(c,{from:'wrong'}); }}),
      el('span',{class:'wgrp-c',text:gids.length+' '+t('q')}),
      el('button',{class:'btn sm ghost wgrp-go',text:t('retryGroup'),onclick:function(){
        const list=C.reviewSample(App.questions,{onlyIds:gids,count:gids.length,recentIds:App.recent},App.rng);
        newSession('wrong',list,{}); renderRunner();
      }})
    ]));
  });
  out.push(card);
  return out;
}
function weakBodyNodes(){ // 「苦手」子視図の本体 (旧 renderWeak 本体; 内容不変)
  const entries=Object.entries(App.progress.weakness).sort((a,b)=>b[1]-a[1]);
  if(!entries.length){ return [ el('div',{class:'card'},[ el('p',{class:'muted jp',text:t('weakNone')}) ]) ]; }
  const out=[];
  const card=el('div',{class:'card'});
  card.appendChild(weakVizNode(entries.slice(0,12).map(function(e){ return e[0]; }),{from:'weak'}));
  if(entries.length>12){ card.appendChild(el('div',{class:'rubt jp',style:'margin-top:14px',text:t('byConcept')}));
    entries.slice(12,40).forEach(function(e){ card.appendChild(rowBtn(e[0],String(e[1]),function(){ renderConcept(e[0],{from:'weak'}); })); }); }
  out.push(card);
  return out;
}
function renderWrongList(){ // 錯題本: 間違えた問題一覧(誤答回数付) → ランダム練習 / 一問ドリル。「苦手を重点的に」の入口(まず間違いを見せてから練習)
  registerFrame(renderWrongList,'wronglist');
  const wrongIds=Object.keys(App.progress.wrong||{});
  const wc={}; (App.progress.attempts||[]).forEach(function(a){ if(a.correct===false) wc[a.id]=(wc[a.id]||0)+1; }); // 誤答回数=attempts 履歴集計
  const kids=[ sectionHead(t('modeWrong')) ];
  if(!wrongIds.length){ // 空: 間違いがまだ無ければ、従来どおり苦手重点(重み付き)へ
    kids.push(el('div',{class:'card'},[ el('p',{class:'muted jp',text:t('wrongNone')}),
      el('button',{class:'btn ghost',style:'margin-top:12px',text:t('weakTile'),onclick:startWeighted}) ]));
    setView(el('div',null,kids)); return;
  }
  const top=el('div',{class:'card'},[ el('p',{class:'muted jp',text:wrongIds.length+' '+t('q')}) ]);
  top.appendChild(el('button',{class:'btn',style:'margin-top:12px',text:t('wrongPractice'),onclick:function(){
    const list=C.reviewSample(App.questions,{onlyIds:wrongIds,count:Math.min(wrongIds.length,20),weakness:App.progress.weakness,recentIds:App.recent},App.rng);
    newSession('wrong',list,{}); renderRunner();
  }}));
  kids.push(top);
  const list=el('div',{class:'card wl-list'});
  wrongIds.map(function(id){ return {q:App.idx.byId[id], n:wc[id]||1}; }).filter(function(r){ return r.q; })
    .sort(function(a,b){ return b.n-a.n; }) // 誤答回数 多い順
    .forEach(function(r){ const q=r.q;
      list.appendChild(el('button',{class:'wl-row',title:t('wrongPracticeOne'),onclick:function(){ newSession('wrong',[q],{}); renderRunner(); }},[
        el('span',{class:'wl-kai mono',text:'回'+q.source.kai}),
        el('span',{class:'wl-q jp',text:q.q}),
        el('span',{class:'wl-n mono',text:t('wrongMiss').replace('{n}',r.n)}) ]));
    });
  kids.push(list);
  setView(el('div',null,kids));
}
function renderWeakWrong(sub){ // 合一 hub: 既定子=苦手(weak); 分段で 苦手↔間違い; 同 key フレーム故, 切替は就地再描画(横移なし)
  sub=(sub==='wrong')?'wrong':'weak';
  registerFrame(function(){ renderWeakWrong(sub); },'weakwrong');
  const kids=[ sectionHead(t('mergeName')) ];
  const seg=el('div',{class:'setseg',style:'margin-bottom:14px'});
  [['weak',t('subWeak')],['wrong',t('subWrong')]].forEach(function(p){
    seg.appendChild(el('button',{class:'segbtn'+(sub===p[0]?' on':''),text:p[1],onclick:function(){ if(sub!==p[0]) renderWeakWrong(p[0]); }}));
  });
  kids.push(seg);
  (sub==='wrong'?wrongBodyNodes():weakBodyNodes()).forEach(function(n){ kids.push(n); });
  setView(el('div',null,kids));
}
