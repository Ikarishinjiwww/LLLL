'use strict';

function renderHome(){
  if(isRxCourse()) return renderRxHome();
  registerFrame(renderHome,'home');
  clearCareTimer(); clearRunnerTimer();
  const m=App.course;
  const hasExam=examResumable();
  const pad=el('div',{class:'h2pad'});
  /* 首页上部の案内は同時に一つまで（U-76：初訪の一言と「ホーム画面に追加」の横幅が重なって首屏を埋めていた）。
   * 優先：ホーム画面アプリ初回の取り込み案内（U-03）＞初訪の一言＞横幅。横幅は、初訪の一言を出したタブでは出さず、次に開いたときに回す。 */
  var a2i=a2hsImportCardNode();
  if(a2i){ pad.appendChild(a2i); }
  else if(!lsGet(nk('helpSeen'),false) && m.shape==='reader'){ // 試験型の課（臨床）の固定の初訪提示は廃止（#10・Q-067-4C：今日の復習と模試が首屏に並ぶ）。読む型（神経）の一言はそのまま
    const hintKey='firstHintReader';
    pad.appendChild(el('div',{class:'firsthint'},[ el('span',{class:'jp',text:t(hintKey)}),
      el('button',{text:'×','aria-label':t('close'),title:t('close'),onclick:function(e){ lsSet(nk('helpSeen'),true); e.target.closest('.firsthint').remove(); }}) ]));
    try{ sessionStorage.setItem('quiz:a2hs-later','1'); }catch(e){}
  }
  else{ var later=false; try{ later=sessionStorage.getItem('quiz:a2hs-later')==='1'; }catch(e){}
    if(!later){ var a2=a2hsBannerNode(); if(a2) pad.appendChild(a2); } }
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
  pad.appendChild(el('p',{class:'careline1b jp'},[ kaoWrap(pick(t('carePool'))) ]));
  setView(el('div',{class:'home2'},[ pad ]),true);
}

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
  const lr=lsGet(nk('lastRead'),null);
  if(!lr) return null;
  const ttl=kaiTitle(lr.kai)||tf('kaiN',{n:lr.kai});
  return el('button',{class:'nh-cont',onclick:function(){ resumeReader(lr); }},[ // 節の中の位置まで戻る（U-50）
    el('span',{class:'nc-l jp',text:t('readingNow')}),
    el('span',{class:'nc-t jp',text:tf('kaiN',{n:lr.kai})+' '+(lr.sec?readerResumeLabel(lr):ttl)}),
    el('span',{class:'nc-a',text:'›'})
  ]);
}
/* 大きな検索欄。神経では検索が主機能なので、飾りでなく本物の入力にして即打てる。 */
function bigSearchNode(){
  const inp=el('input',{class:'nh-si jp',type:'text',
    placeholder:t('nhSearchPh')});
  const go=function(){ renderSearch(inp.value||''); };
  inp.addEventListener('keydown',function(e){ if(e.key==='Enter') go(); });
  return el('div',{class:'nh-search'},[
    el('div',{class:'nh-srow'},[ svgNode(NEW_ICONS.search), inp,
      el('button',{class:'nh-sb jp',text:t('nhSearchBtn'),onclick:go}) ]),
    el('div',{class:'nh-shint jp',
      text:t('nhSearchHelp')})
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
      el('span',{class:'nk-n',text:tf('kaiN',{n:u.kai})}),
      el('span',{class:'nk-t jp',text:kaiTitle(u.kai)||u.subtitle||''}),
      el('span',{class:'nk-kw'}, kws.map(function(k){ return el('em',{class:'jp',text:k}); }))
    ]));
  });
  return grid;
}
function caveatPanelNode(){
  const f=neuroFacts();
  if(!f.cavList.length) return null;
  const box=el('div',{class:'spanel nh-cav'});
  box.appendChild(el('div',{class:'sph'},[
    el('b',{class:'jp',text:t('cavTitle')}),
    el('small',{class:'jp',text:tf('cavCount',{n:f.caveats})}) ]));
  f.cavList.forEach(function(c){
    box.appendChild(el('button',{class:'nh-cv',onclick:function(){ gotoCard(c.cardId,c.term); }},[
      el('span',{class:'cv-t jp',text:c.term}),
      el('span',{class:'cv-x jp',text:c.exam||''}),
      el('span',{class:'cv-k',text:tf('kaiN',{n:c.kai})+' ›'})
    ]));
  });
  return box;
}
function examStripNode(){
  const f=neuroFacts();
  return el('button',{class:'nh-exam',onclick:function(){ renderQuestionList(); }},[
    el('span',{class:'ne-t jp',text:tf('exQuizOpen',{n:f.questions})}),
    /* 「誤りを選べ」の数はデータから数える。文面に直書きすると問題が増えた時に嘘になる。 */
    el('span',{class:'ne-d jp',text:(function(){
      const n=(App.questions||[]).filter(function(q){return q.negative;}).length;
      if(!n) return t('exQuizLead0');
      return tf('exQuizLeadN',{n:n});
    })()}),
    el('span',{class:'ne-a',text:'›'})
  ]);
}
function neuroHome(pad){
  /* 臨床と同じ入り方に揃える(設計決定):コース名の見出しではなく、挨拶 → 試験日ライン。
   * コース名は topbar の chip に出ているので、本文でもう一度名乗る必要がない。 */
  const left=daysUntilExam(), pace=suggestedPace();
  let subHtml;
  if(left!=null&&left>0){ subHtml=examSubHtml(left,pace); }
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
  const nb=(lsGet(nk('readerBm'),[])||[]).length; // しおりを挟んだら、ここから一覧へ（神経にはしおり一覧の入口が無かった：S6 U-28）
  if(nb) pad.appendChild(el('button',{class:'nh-cont',onclick:renderReaderMarks},[ el('span',{class:'nc-l jp',text:t('subBook')}), el('span',{class:'nc-t jp',text:tf('itemCount',{n:nb})}), el('span',{class:'nc-a',text:'›'}) ]));
  pad.appendChild(el('div',{class:'nh-sec jp',text:t('nhByKai')}));
  pad.appendChild(kaiGridNode(false));
  const cav=caveatPanelNode(); if(cav) pad.appendChild(cav);   /* 強調の引用一覧はホームから撤去。強調はカード本文の中でだけ出す */
  pad.appendChild(examStripNode());
}


function quarantinedIds(){ const s=readExam(); return (s&&Array.isArray(s.ids))?s.ids:null; } // phase∈{answering,grading} 时才隔离
function isQuarantined(id){ const q=quarantinedIds(); return !!(q && q.indexOf(id)>=0); }
function toast(msg){ try{ const n=el('div',{class:'toast jp',role:'status','aria-live':'polite',text:msg}); document.body.appendChild(n); requestAnimationFrame(function(){ n.classList.add('in'); }); // 読み上げにも届ける。表示時間は文の長さに合わせる（長い文が読み切れずに消えない）
  setTimeout(function(){ n.classList.remove('in'); setTimeout(function(){ if(n.parentNode) n.remove(); },300); },Math.max(2600,String(msg).length*90)); }catch(e){} }
function newSession(mode,list,opts){ if(!canWrite()) return null;
  examDropClean(); // 自分の定稿済み模試の会話を上書きする前に、残った本場の記録を消し直す（X17c-01：結果頁から直接練習へ。隔離の判定より先）
  if(mode!=='exam'){ const ql=quarantinedIds(); if(ql&&ql.length) list=list.filter(function(q){ return ql.indexOf(q.id)<0; }); }
  if(!list||!list.length){ toast(t('reviewEmptyExam')); return null; }
  App.session={ mode:mode, list:list, pos:0, opts:opts||{}, perItem:{}, results:[], streak:0, frontier:0, startAt:Date.now(), elapsedMs:0, runningSince:(mode!=='exam')?Date.now():0, answeredCount:0, lastCareElapsed:0, lastCareAnswered:0, recentWindow:[] };
  if(!(opts&&opts.from==='reader')) App.readerReturn=null; // 手册発以外の会話開始時は戻る先を破棄(旧 readerReturn の漏れ防止 → 模考等に誤って「戻る」が出ない)
  baseHome(); // 会话坐落在 [home, runner]: 退出/返回回首页
  clearCareTimer(); if(mode!=='exam') startCareTimer();
  return App.session;
}
function pushRecent(id){ App.recent.push(id); if(App.recent.length>40) App.recent.shift(); }

/* ===== mock-exam state machine: 盲答 answering → 批改 grading → 定稿 finalized ===== */
/* 内容指纹 (FNV-1a 32-bit): 题干 + 选项 + 评分点 + 模範解答; 恢复时逐题比对, 不符则整场作废 */
function fnv1a(str){ let h=0x811c9dc5; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,0x01000193); } return (h>>>0).toString(36); }
function contentFp(q){ const p=[q.q||'']; if(q.options) p.push(JSON.stringify(q.options)); if(q.rubric) p.push(JSON.stringify(q.rubric)); if(q.modelAnswer) p.push(JSON.stringify(q.modelAnswer)); return fnv1a(p.join('\u241F')); }
function examPerm(q){ return C.shuffleOptions(q.options.map(function(_,i){return i;}),App.rng); } // 冻结的原始下标排列 (持久化, 刷新可复原)
/* examInProgress 读写: iv=2 内部版本号(仅管此键); 仅 phase∈{answering,grading} 视为有效进行中 */
function readExam(){ const s=lsGet(nk('examInProgress'),null); if(!s||s.iv!==2) return null; if(s.phase!=='answering'&&s.phase!=='grading') return null; return s; }
function examResumable(){ return !!readExam(); }
function reconcileExam(){ const r=lsRead5(nk('examInProgress'),lsObj); if(r.st==='ok' && (r.v.iv===undefined || r.v.iv===1)){ lsDel(nk('examInProgress')); } } // 旧格式（iv 無し・iv:1）だけ硬作废(防陈旧隔离)。壊れた・知らない版（iv:3 など）は消さない（五態の厳格な読み：WLR1 WL-03）
function examStoreOk(){ const st=lsRead5(nk('examInProgress'),function(v){ return lsObj(v) && v.iv===2; }).st; return st==='none' || st==='ok'; } // 模試の記録に書いてよいか：無いか、今の形（iv:2）のとき
/* 计时: 累计在场时间 elapsedMs + 当前计时段起点 runningSince(暂停时为0) */
function examElapsed(){ const s=App.session; if(!s) return 0; return (s.elapsedMs||0)+(s.runningSince?(Date.now()-s.runningSince):0); }
function clockShouldRun(s){ return !!(s && ((s.mode==='exam' && s.phase==='answering') || s.mode!=='exam')); } // exam:仅答题阶段; 练习:整个 runner 期 (离页由 onVisibility 冻结 elapsed)
function pauseSessionClock(s){ if(s&&s.runningSince){ s.elapsedMs=(s.elapsedMs||0)+(Date.now()-s.runningSince); s.runningSince=0; if(s.mode==='exam') persistExam(); } }
function resumeSessionClock(s){ if(clockShouldRun(s) && !s.runningSince){ s.runningSince=Date.now(); } }
function onVisibility(){ if(document.hidden){ try{ if(typeof readerFlush==='function') readerFlush(); }catch(e){} } // 後景へ（iOS の PWA はこの事件しか来ないことが多い）：読んでいた位置を同期で持久化（replacingData の守りは readerPersistNow 側：CR433-6 第 2 条）
  const s=App.session; if(!s) return; if(document.hidden){ pauseSessionClock(s); if(s.mode==='exam') persistExam(); } else resumeSessionClock(s); } // 隠れたら記述の入力もすぐ残す

function startExam(){ if(!canWrite() || quotaStopped()) return; // 容量の 90% 以上は新しい模試を始めない（WLR1 WL-08）
  if(!examStoreOk()){ examBadNotice(); return; } // 盤上の模試の記録が読めない・知らない版：始めない（保存できないまま模試を進めない：WLR2 応修 8）。知らせて、その記録だけを消す出口を出す
  if(examResumable()){ // 前の試験を消して始める：同期の confirm() は使わない（X13-01）。確かめたあと一度タスクを譲り、書き手を確かめ直してから
    askConfirm(t('cmExam'),t('examOverwriteConfirm'),t('examOverwriteOk'),true).then(function(ok){ return ok && afterConfirm(); }).then(function(ok){ if(ok) startExamNow(); });
    return;
  }
  startExamNow();
}
function examBadNotice(){ dataBad(nk('examInProgress')); // 五態の厳格な読み：読めない記録は上書きしない。消すのは利用者が選んだときだけ
  askConfirm(t('cmExam'),t('examBadBody'),t('examBadDrop'),true).then(function(ok){ return ok && afterConfirm(); }).then(function(ok){ if(ok) examBadDropNow(); }); }
function examBadDropNow(){ if(!holdsWriter()) return false; if(examStoreOk()) return true; // 読めない模試の記録だけを消す（進度・調度・履歴には触れない：軽重置で全部消さなくてよい出口。WLR2 応修 8）
  const ok=lsDel(nk('examInProgress')); if(ok) forgetUnsaved(nk('examInProgress')); return ok; }
function startExamNow(){
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
function persistExam(){ const s=App.session; if(!s||s.mode!=='exam') return true; // 戻り値＝書けたか（交接前の書き切りが確かめる）
  if(replacingData) return true; // 存档を置き換えたあと（再読み込みの前）：どの経路（onVisibility・blur・pagehide）からも記憶の模試を書き戻さない（WLR1 合并裁定 三-7）
  if(s.phase==='finalized') return examFinalClean(s); // 定稿済みは書き戻さない（B-059）。ただし定稿時に消せなかった本場の記録は消し直す（X17-01）
  if(!examStoreOk()) return dataBad(nk('examInProgress')); // 盤上の模試の記録が読めない・壊れている・知らない版：「無い」とみなして上書きしない（五態の厳格な読み：WLR1 WL-03）
  const perItem=serializePerItem();
  const ok=lsSet(nk('examInProgress'),{ iv:2, phase:s.phase, ids:s.list.map(function(q){return q.id;}), pos:s.pos,
    elapsedMs:examElapsed(), fp:s.fp||{}, perItem:perItem });
  if(ok) s.synced=examRaws(perItem); // この文書が最後に書けた記述（恢復框の告知はこれと比べる。今の存档と比べると、交接後に別の書き手が正当に書き換えた分まで「保存できなかった」と出す：N4-01）
  return ok;
}
/* X17-01：定稿時に examInProgress を消せなかったら、盤上には本場の再開できる記録が残る。交接・離脱・切り替えのたびにここで確かめ、
 * 本場の記録（題の並びが同じもの）だけを消し直す。消せなければ以前どおり作廃の記録（phase:'finalized'）で上書きする。
 * 盤上に本場の再開できる記録が無いと確かめられたときだけ true（交接はそれまで既存の有界再試で断る）。別の模試の記録や再開できない記録には触らない */
function examFinalClean(s){
  const key=nk('examInProgress'); let raw;
  try{ raw=localStorage.getItem(key); }catch(e){ return false; } // 読めない＝消えたか確かめられない
  if(raw==null) return true;
  let v=null; try{ v=JSON.parse(raw); }catch(e){}
  const ids=s.list.map(function(q){ return q.id; }).join('\n');
  const mine=!!(v && v.iv===2 && (v.phase==='answering'||v.phase==='grading') && Array.isArray(v.ids) && v.ids.join('\n')===ids);
  if(!mine) return true;
  const gone=function(ph){ try{ const r=localStorage.getItem(key); if(r==null) return true; const w=JSON.parse(r); return !!(ph && w && w.phase===ph); }catch(e){ return false; } };
  if(lsDel(key) && gone(null)) return true;
  if(lsSet(key,{ iv:2, phase:'finalized', ids:v.ids, pos:v.pos||0, elapsedMs:v.elapsedMs||0, fp:v.fp||{}, perItem:{} }) && gone('finalized')) return true;
  return false;
}
function examDropClean(){ // X17b-01：定稿済みの模試の会話を捨てる前に、盤上に残った本場の再開できる記録を消し直す（定稿時に消すのも作廃も失敗し、そのあと存儲が戻った場合の兜底）
  const s=App.session; if(!s || s.mode!=='exam' || s.phase!=='finalized' || !writerOk) return;
  try{ examFinalClean(s); }catch(e){}
}
/* 恢復框の縮小版（合成稿 v3.3 四）：接管・往返で読み直すと消える「保存できなかったもの」を、その場で告知し、下書きは复制できるようにする。
 * 解答欄に戻す・待ちとして持ち越す・あとで補写することはしない。取り分けは becomeWriter の同じ処理の中で作って見せる */
function examRaws(perItem){ const o={}; Object.keys(perItem||{}).forEach(function(id){ const r=(perItem[id]||{}).raw; if(r) o[id]=r; }); return o; }
function lostNow(){ // 読み直す直前：この文書が書けずにいた記述の下書き（記憶の値が、この文書が最後に書けた・読み込んだ値と違うもの）と、保存できなかった作答の件数
  const out={drafts:[], n:Object.keys(App.unsavedAns||{}).length}, s=App.session;
  if(s && s.mode==='exam' && s.phase!=='finalized'){ const syn=s.synced||{};
    s.list.forEach(function(q){ if(q.type!=='subjective') return; const raw=(s.perItem[q.id]||{}).raw||'';
      if(raw.trim() && raw!==(syn[q.id]||'')) out.drafts.push({raw:raw, head:((typeof q.q==='string'?q.q:L(q.q))||'').slice(0,40)}); }); }
  return (out.drafts.length || out.n)?out:null;
}
function showLostDrafts(lost){
  const box=el('div',{'data-recovery':'1'});
  if(lost.n) box.appendChild(el('p',{class:'jp',text:tf('lostAnswersN',{n:lost.n})}));
  if(lost.drafts.length) box.appendChild(el('p',{class:'jp',text:t('lostDraftLede')}));
  lost.drafts.forEach(function(d){
    const ta=el('textarea',{class:'answer jp',rows:'4',readonly:'readonly'}); ta.value=d.raw;
    const row=el('div',{class:'row',style:'gap:8px;margin:6px 0 14px;align-items:center'},[
      el('button',{class:'btn ghost sm jp',text:t('copy'),onclick:function(){ try{ navigator.clipboard.writeText(d.raw).then(function(){ toast(t('copied')); },function(){ ta.select(); }); }catch(e){ ta.select(); } }}) ]);
    box.appendChild(el('div',{class:'lost-d'},[ el('div',{class:'tl jp',text:d.head+'…'}), ta, row ]));
  });
  openModal(modalShell(t(lost.drafts.length?'lostDraftTitle':'lostAnswersTitle'),[box]));
}
function resumeExam(){ if(!canWrite()) return;
  const saved=readExam();
  if(!saved){ lsDel(nk('examInProgress')); toast(t('examInvalidated')); return renderHome(); }
  const list=saved.ids.map(function(id){ return App.idx.byId[id]; });
  let bad=list.some(function(q){ return !q; });
  if(!bad && saved.fp) bad=saved.ids.some(function(id){ const q=App.idx.byId[id]; return !q || contentFp(q)!==saved.fp[id]; });
  if(bad){ lsDel(nk('examInProgress')); toast(t('examInvalidated')); return renderHome(); }
  const s=newSession('exam',list,{}); if(!s) return;
  s.phase=(saved.phase==='grading')?'grading':'answering';
  s.pos=Math.min(saved.pos||0,list.length-1); s.frontier=s.pos;
  s.elapsedMs=saved.elapsedMs||0; s.runningSince=(s.phase==='answering')?Date.now():0; s.fp=saved.fp||{}; s.synced=examRaws(saved.perItem); // 読み込んだ値＝存档にある値
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
  runner.appendChild(el('div',{class:'examstrip-w'},[ examNavStrip(), el('button',{class:'exam-ov-btn',type:'button','aria-label':t('examOverview'),title:t('examOverview'),'aria-haspopup':'dialog',html:NEW_ICONS.grid,onclick:openExamOverview}) ])); // 題号の一覧（U-54）
  const body=el('div',{class:'rbody'});
  const timerEl=el('span',{class:'qtimer'}); // 時計は題頭行（Q.01 の行）へ：題頭行は顶栏の下に sticky なので、操作条が流れに戻った長い題でも残り時間が見える（V-11 補、総指揮 10-15）。U-54 の「上に置くと顶栏の下に隠れた」は absolute だったため：sticky の top を顶栏の高さにそろえる
  body.appendChild(el('div',{class:'qhd'},[
    el('div',{class:'qhd-l'},[ el('button',{class:'qhome jp',text:'‹ '+t('home'),onclick:function(){ leaveGuard(exitToHome); }}), sessionBackBtn(), el('div',{class:'crs jp'},[ el('span',{class:'qmode',text:modeLabel()}), el('b',{text:L(App.course.title)}) ]) ]) // 戻る類は左上にそろえる（S6 U-68）
  ]));
  body.appendChild(el('div',{class:'qnum'},[
    el('span',{class:'n',text:'Q.'+String(s.pos+1).padStart(2,'0')}),
    el('span',{class:'mode',text:typeLabel(q.type)}),
    qnumBookmarkBtn(q),
    el('span',{class:'prog',text:String(s.pos+1).padStart(2,'0')+' / '+s.list.length}),
    timerEl
  ]));
  body.appendChild(el('div',{class:'qbar'},[ el('i',{style:'width:'+Math.round((s.pos+1)/s.list.length*100)+'%'}) ]));
  body.appendChild(qtextNode(q.q));
  const st=s.perItem[q.id]||(s.perItem[q.id]={uncertain:false});
  if(q.type==='choice') examChoiceBody(q,st,body); else examSubjectiveBody(q,st,body);
  body.appendChild(examUncertainToggle(q,st));
  body.appendChild(examAnswerNav(null));
  if(qStep!=='none'){ body.classList.add(qStep==='next'?'qstep-next':'qstep-prev'); qStep='none'; }
  runner.appendChild(body);
  registerFrame(renderRunner,'runner'); setView(runner);
  examNavFlow(); // 模試：選択肢が一画面に収まらない題は、吸底の操作条が最後の肢を覆う（S8 persona V-11）→ 流れに戻す（収まる題は従来どおり吸底）
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
  strip.appendChild(el('span',{class:'estrip-pad'}));
  examStripEl=strip; examStripFor=s; examStripScroll=0;
  syncExamStrip(strip); return strip;
}
function syncExamStrip(strip){ const s=App.session; if(!strip||!s) return; // チップの cur/done/unc を現状に同期(要素は使い回し)
  const chips=strip.querySelectorAll('.echip');
  s.list.forEach(function(q,i){ const st=s.perItem[q.id]||{}; const answered=(q.type==='choice')?(st.picked!=null):!!(st.raw&&st.raw.trim());
    const c=chips[i]; if(c) c.className='echip'+(i===s.pos?' cur':'')+(answered?' done':'')+(st.uncertain?' is-unc':''); });
}
function centerExamStrip(){ // 現在題を中央へ, 前位置から一格だけ滑らかにスクロール
  const strip=examStripEl; if(!strip||!strip.isConnected) return;
  const cur=strip.querySelector('.echip.cur'); if(!cur) return;
  const pad=0; // 先頭の題を中央に寄せるための余白は置かない（Q1 で左半分が空いていた：U-54）。端の題は端に寄ったまま
  strip.querySelectorAll('.estrip-pad').forEach(function(p){ if(p.style.width!==pad+'px') p.style.width=pad+'px'; });
  if(Math.abs(strip.scrollLeft-examStripScroll)>1) strip.scrollLeft=examStripScroll; // DOM移動でリセットされた位置を即復元 → smoothの起点を前回中央に
  const sr=strip.getBoundingClientRect(), cr=cur.getBoundingClientRect();
  const target=Math.max(0, Math.round(strip.scrollLeft + (cr.left-sr.left) - (strip.clientWidth/2 - cr.width/2)));
  const reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){ strip.scrollLeft=target; } else { strip.scrollTo({left:target, behavior:'smooth'}); }
  examStripScroll=target;
}
function examChoiceBody(q,st,body){ const wrap=el('div',{class:'opts','data-q':q.id}); const perm=st.perm||(st.perm=examPerm(q));
  perm.forEach(function(oi,pi){ const o=q.options[oi], sel=(st.picked===oi);
    const btn=el('button',{class:'opt jp'+(sel?' sel':''),'aria-pressed':String(!!sel),'data-oi':String(oi)},[ el('span',{class:'mk',text:'ABCDEF'[pi]||''}), el('span',{text:o.t}) ]);  /* 選択状態を支援技術へ */
    btn.addEventListener('click',function(){ answerChoice(q,o); });
    wrap.appendChild(btn); });
  body.appendChild(wrap);
}
function examSubjectiveBody(q,st,body){ const wrap=el('div',{class:'ta-wrap'});
  const ta=el('textarea',{class:'answer jp',placeholder:t('ansPh'),rows:'5'});
  ta.value=st.raw||'';
  let saveTimer=null, firstDirty=0;
  function saveDraft(){ if(saveTimer){ clearTimeout(saveTimer); saveTimer=null; } firstDirty=0; if(persistExam()===false) pulseWriterBanner(); } // 保存できなければ文は残し、帯を閃かせる（N-E）
  ta.addEventListener('beforeinput',function(e){ if(!canWrite()) e.preventDefault(); }); // 書けないあいだは打ち込みを止める：打った字が保存されず、引き継ぎで消えていた（CR-08）。説明は canWrite が出す
  ta.addEventListener('input',function(){ if(!writerOk){ ta.value=st.raw||''; return; } st.raw=ta.value; // 打っている途中も残す（別タブへの引き継ぎ・強制終了で消さない）。止められない入力（変換確定など）は保存済みの文に戻す
    const now=Date.now(); if(!firstDirty) firstDirty=now;
    if(saveTimer) clearTimeout(saveTimer);
    saveTimer=setTimeout(saveDraft,Math.max(0,Math.min(400,firstDirty+2000-now))); }); // 手を止めて 0.4 秒、打ち続けても未保存の最初の一文字から 2 秒で必ず残す
  ta.addEventListener('change',saveDraft);
  wrap.appendChild(ta); body.appendChild(wrap);
}
function examPaintChoice(q,st){ // 選んだ印だけ塗り替える（作り直すと押したボタンが消え、Chrome 系で画面が約 72px 上へずれた：O-17）
  const wrap=document.querySelector('.exam-answer .opts'); if(!wrap || wrap.getAttribute('data-q')!==q.id) return false;
  wrap.querySelectorAll('.opt').forEach(function(b){ const sel=(+b.getAttribute('data-oi')===st.picked); b.classList.toggle('sel',sel); b.setAttribute('aria-pressed',String(sel)); });
  if(examStripEl) syncExamStrip(examStripEl);
  return true;
}
function examUncertainToggle(q,st){ const on=!!st.uncertain;
  const b=el('button',{class:'unc'+(on?' on':''),'aria-pressed':String(!!on)},[ el('span',{class:'mk',text:on?'✓':''}), el('span',{class:'jp',text:t('examUncertain')}) ]);
  b.addEventListener('click',function(){ if(!canWrite()) return; st.uncertain=!st.uncertain; if(persistExam()===false) pulseWriterBanner(); renderRunner(); }); // 書けないなら変えない（CR-08）。保存できなければ記憶に残し帯で知らせる（X15d-01・N-E）
  return b;
}
function examNavFlow(){ requestAnimationFrame(function(){ const nav=document.querySelector('.runner.exam-answer .examnav'); if(!nav) return; // 基点では、未スクロールの初見で D が吸底の帯の下に隠れ（22〜72px）、帯が「ここで終わり」に見えて 2/3 が滚らずに答えた（滚り切れば帯は流れに戻るので覆わない）。従来の吸底は RX_FLAGS.examNav='sticky' で残す
  nav.classList.toggle('flow', !(window.RX_FLAGS && RX_FLAGS.examNav==='sticky') && document.documentElement.scrollHeight>window.innerHeight+8); }); }
window.addEventListener('resize', examNavFlow); // 回転・ツールバーの出入りで収まり方が変わる
function examAnswerNav(timerEl){ const s=App.session, row=el('div',{class:'examnav'}), last=s.pos>=s.list.length-1;
  const prev=el('button',{class:'btn ghost',text:t('prev'),onclick:goPrev}); if(s.pos<=0) prev.disabled=true;
  const next=el('button',{class:'btn'+(last?' ghost':''),text:t('next'),onclick:goNext}); if(last) next.disabled=true; // 主ボタンは「次へ」（「採点する」が一番目立っていた：U-54）
  const submit=el('button',{class:'btn'+(last?'':' ghost'),text:t('examSubmit'),onclick:openSubmitCheck}); // 最後の題でだけ「採点する」が主ボタン
  if(timerEl) row.appendChild(timerEl);
  row.appendChild(prev); row.appendChild(next); row.appendChild(submit);
  return row;
}
function examJump(i){ const s=App.session; if(!s) return; closeModal(); if(i!==s.pos){ s.pos=i; persistExam(); qStep='none'; renderRunner(); } }
function openExamOverview(){ const s=App.session; if(!s) return; // 題号の一覧（5 列）：解答済み・未解答・自信がない、押すとその題へ（U-54）
  const grid=el('div',{class:'exam-ov-grid'});
  s.list.forEach(function(q,i){ const st=s.perItem[q.id]||{}, done=(q.type==='choice')?(st.picked!=null):!!(st.raw&&st.raw.trim());
    grid.appendChild(el('button',{class:'exam-ov-q mono'+(done?' done':'')+(st.uncertain?' is-unc':'')+(i===s.pos?' cur':''),type:'button','aria-current':i===s.pos?'true':null,text:String(i+1),onclick:function(){ examJump(i); }})); });
  const lg=el('div',{class:'exam-ov-lg jp'},[ el('span',{class:'lg-done',text:t('examOvDone')}), el('span',{class:'lg-todo',text:t('examOvTodo')}), el('span',{class:'lg-unc',text:t('examUncertain')}) ]);
  openModal(modalShell(t('examOverview'),[ el('div',{class:'exam-ov'},[ lg, grid ]) ]));
}
function openSubmitCheck(){ const s=App.session, unans=[], blank=[], unc=[];
  s.list.forEach(function(q,i){ const st=s.perItem[q.id]||{};
    if(q.type==='choice'){ if(st.picked==null) unans.push(i+1); } else { if(!(st.raw&&st.raw.trim())) blank.push(i+1); }
    if(st.uncertain) unc.push(i+1); });
  const body=[];
  if(!unans.length && !blank.length && !unc.length) body.push(el('p',{class:'jp',text:t('examAllDone')}));
  const mk=function(label,arr,warn){ if(!arr.length) return; body.push(el('div',{class:'chkline'+(warn?' warn':'')},[ el('div',{class:'cl-l jp',text:label}),
    el('div',{class:'cl-n'},arr.map(function(n){ return el('button',{class:'sc-q mono',type:'button',text:String(n),onclick:function(){ examJump(n-1); }}); })) ])); }; // 題号を押すとその題へ（U-54）
  mk(t('examUnanswered'),unans,true); mk(t('examBlank'),blank,true); mk(t('examUncList'),unc,false);
  if(unans.length||blank.length) body.push(el('p',{class:'jp warn',style:'margin-top:10px',text:t('examWillWrong')}));
  body.push(el('div',{class:'row',style:'margin-top:14px;gap:10px'},[
    el('button',{class:'btn',text:t('examDoSubmit'),onclick:function(){ closeModal(); submitExam(); }}),
    el('button',{class:'btn ghost',text:t('back'),onclick:closeModal})
  ]));
  openModal(modalShell(t('examSubmitTitle'),body));
}
function submitExam(){ if(!canWrite()) return; const s=App.session; if(!s||s.mode!=='exam') return;
  pauseSessionClock(s); clearRunnerTimer(); s.phase='grading';
  if(persistExam()===false){ s.phase='answering'; resumeSessionClock(s); renderRunner(); pulseWriterBanner(); return; } // 採点へ進んだことが保存できなければ作答に留まる（帯が知らせる：CR-13・N-E）
  baseHome(); renderGrading();
}

/* ---- 批改阶段 (grading): 客观自动判 + 记述逐要点自评; 全部记述确定后方可定稿 ---- */
function explTiersNode(q){ // 解説 tiers: 簡短解説(常時) + 詳しい解説(折りたたみ); runner と 採点結果カードで共用
  const sx=LT(q.explainShort), lg=LT(q.explainLong);   /* {ja:""} は「無し」 */
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
  wrap.appendChild(el('div',{class:'sechd'},[ el('button',{class:'back',text:'‹ '+t('home'),onclick:function(){ leaveGuard(exitToHome); }}), el('h2',{class:'jp',text:t('gradingTitle')}) ])); // 左上＝戻る（S6 U-68） // 中断可(phase=grading 持久化 → 中断続行で復帰)
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
        el('div',null,[ el('div',{class:'rt jp',text:L(rb.point)}), el('span',{class:'rb-st',text:(on?('✓ '+t('hitConcept')):('○ '+t('missConcept')))+' · '+rb.concept}) ]) ]);
      row.addEventListener('click',function(){ if(!canWrite()) return; const y=window.scrollY; st.checked[k]=!st.checked[k]; const ok=persistExam()!==false; renderGrading(); window.scrollTo(0,y); if(!ok) pulseWriterBanner(); }); // CR-08・N-E
      card.appendChild(row); });
    const total=q.rubric.length, hit=Object.keys(st.checked).filter(function(k){return st.checked[k];}).length;
    const pct=Math.round(C.subjectivePercent(hit,total)*100);
    const lvlKey=(hit===total)?'full':(hit===0?'none':'part'), lvlTxt=(hit===total)?t('masteryFull'):(hit===0?t('masteryNone'):t('masteryPart'));
    card.appendChild(el('div',{class:'scoreline jp'},[ el('span',{class:'lvl '+lvlKey,text:lvlTxt}), document.createTextNode('　'+pct+'%（'+tf('ptsOf',{total:total,u:t('ofPoints'),hit:hit})+'）') ]));
    const evb=el('button',{class:'btn sm'+(st.evaluated?' ghost':''),style:'margin-top:10px',text:st.evaluated?t('gradeConfirmed'):t('gradeConfirm')});
    evb.addEventListener('click',function(){ if(!canWrite()) return; const y=window.scrollY; st.evaluated=true; const ok=persistExam()!==false; renderGrading(); window.scrollTo(0,y); if(!ok) pulseWriterBanner(); }); // CR-08・N-E
    card.appendChild(evb);
  }
  return card;
}

/* ---- 定稿 (finalized): 一次性延迟批改写入 + exams++ + 单次落盘; 仅此处清键解除隔离 ---- */
function flushExamToProgress(){ const s=App.session; // 4.2.0 の採点と記録（記憶の進度に積み、間隔復習を書く）。戻り値＝間隔復習が書けて確かめられたか（使わない課は true）。進度を書くのは定稿の側
  const spPre=spLoad(), spList=[]; // 間隔復習：採点前の誤答集合で初期化した状態に、全問を一度に書く（「自信がない」印＝自信なし）
  s.list.forEach(function(q){ const st=s.perItem[q.id]||{};
    if(q.type==='choice'){ const picked=(st.picked!=null)?q.options[st.picked]:null, correct=C.gradeChoice(picked);
      st.correct=correct; st.answered=true;
      recordAttempt(q,{type:'choice',correct:correct,ans:{selectedOption:picked}},{defer:true});
      spList.push({id:q.id,ok:correct,unsure:!!st.uncertain});
    } else { const total=q.rubric.length, checked=st.checked||{};
      const hit=Object.keys(checked).filter(function(k){return checked[k];}).length, missed=[];
      q.rubric.forEach(function(rb,k){ if(!checked[k]) missed.push(rb.concept); });
      st.correct=(hit===total); st.percent=C.subjectivePercent(hit,total); st.missed=missed; st.answered=true;
      recordAttempt(q,{type:'subjective',correct:st.correct,percent:st.percent,ans:{checkedConcepts:[],missedConcepts:missed},raw:st.raw},{defer:true});
      spList.push({id:q.id,ok:st.correct,unsure:!!st.uncertain});
    } });
  App.progress.stats.exams=(App.progress.stats.exams||0)+1;
  return !feat('spaced') || spRecord(spList,spPre);
}
function finalizeExam(){ if(!canWrite() || quotaStopped()) return; if(!quotaAdmit) return quotaAdmitted(finalizeExam,this,arguments); const s=App.session; if(!s||s.mode!=='exam'||s.phase==='finalized') return; // 90% 以上は定稿しない（採点に留まる。整理してから定稿：WLR1 WL-08）。会話の守卫は独立の文（2b48e66 の注釈に呑まれていた：WLR2 応修 3）
  const pending=s.list.some(function(q){ return q.type==='subjective' && !(s.perItem[q.id]&&s.perItem[q.id].evaluated); });
  if(pending){ toast(t('finalizeLocked')); return; }
  // 定稿＝一つの写入単元（合成稿 v3.3）：間隔復習 → 進度の順に同じ処理の中で書く。どちらかが書けなければ、書けた間隔復習を戻し、記憶も定稿前に戻して採点の画面に留まる（草稿は消さない：CR-13）
  const progSnap=JSON.stringify(App.progress), sk=nk('sched'), rd=function(){ try{ return {v:localStorage.getItem(sk)}; }catch(e){ return null; } }, sched0=rd();
  const spOk=flushExamToProgress(), progOk=spOk && saveProgress()!==false;
  if(!progOk){
    const now=rd(), moved=!!(sched0 && (!now || now.v!==sched0.v)); // 動いたか分からない（読めない）ときも戻しを試みる
    const back=!moved || (sched0.v==null?lsDel(sk):lsSetRaw(sk,sched0.v));
    if(back){ App.progress=JSON.parse(progSnap); noteSave(spOk?nk('progress'):sk,false); renderGrading(); pulseWriterBanner(); return; }
    noteSave(nk('progress'),false); toast(t('examPartialSave')); // 戻しも書けず間隔復習だけが残った（契約外）：結果は出すが「未完整保存」を知らせる。採点のやり直しは求めない（重ねて数えない）。記憶の進度は持ったまま、次に進度が書けたとき一緒に入る
  }
  examFinalClean(s); // 消すか、消せなければ作廃の記録を書いて読み返す：定稿のその時点で再開できる記録を残さない（X17b-01）
  const log=[]; s.list.forEach(function(q){ const st=s.perItem[q.id]; log.push({ id:q.id, type:q.type, correct:st.correct, ans:{ missedConcepts:st.missed } }); });
  const agg=C.aggregateWeakness(log,App.idx.byId);
  if(!saveExamHistory(s,agg)) pulseWriterBanner(); // 模試結果を履歴へ(回看用・PROGRESS とは別キーの追加保存)。定稿の順序は変えない（総指揮裁定）：書けなければ未保存の帯を出し、閃かせる
  s.phase='finalized';
  baseHome(); App._bloom=false; renderResult(agg,s.list.length,s.list.length); showRestPop();
}

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
    onEnter:function(q){ const s=App.session; if(s.mode==='exam'&&s.phase==='answering'){ goNext(); return true; } const st=s.perItem[q.id]||(s.perItem[q.id]={}); if(!st.revealed && writerPreparing){ prepNotice(); return true; } if(!st.revealed){ st.revealed=true; st.checked=st.checked||{}; renderRunner(); return true; } goNext(); return true; }
  }
};
let focusByTab=false; // 焦点を最後に動かしたのが Tab キーか（B-041）。Tab で true、指（マウス・タッチ）で false。Enter 自身では変えない
function noteFocusKey(e){ if(e.key==='Tab') focusByTab=true; }
function noteFocusPointer(){ focusByTab=false; }
function focusControl(tg){ return (tg && tg.closest && tg.closest('button, a[href], summary, [role="button"], [role="link"]')) || null; } // 焦点のあるボタン類（無ければ null）
function focusOnControl(tg){ // Enter をボタン自身に任せるか（B-041）：Tab で移ってきたボタン類だけ。マウスで押した直後に焦点が残っているボタン（Chromium）や本文・body なら従来どおり Enter＝次へ——
  // 押したばかりの ★・自信がない・複選肢をもう一度押して黙って反転させない（CR433-29 必修 2）。:focus-visible は使わない：Chromium はキーを押した瞬間に焦点の要素を :focus-visible にするので、Enter の keydown の中では常に真になる
  return !!(focusControl(tg) && focusByTab); }
function overlayOpen(){ // モーダル・talk 窓・コース浮きのいずれかが開いているか（キー経路と模試書き込みガードの共通判定）
  const root=document.getElementById('modalRoot'); if(root&&root.firstChild) return true;
  const mc=document.getElementById('buddyChat'); if(mc&&mc.classList.contains('on')) return true;
  return !!(document.getElementById('cpop') || document.getElementById('tbMenu') || document.getElementById('viewer') || document.querySelector('.rdr-fs-wrap.open')); // 「…」メニュー・看图器・Aa も浮層：開いている間は答題キーを受けない（Codex 复查 N-02）
}
function onKey(e){
  if(e.key==='Escape'){ const root=document.getElementById('modalRoot'); if(root&&root.firstChild){ closeModal(); e.preventDefault(); return; }
    const mc=document.getElementById('buddyChat'); if(mc&&mc.classList.contains('on')){ closeBuddyChat(); e.preventDefault(); } return; } // ダイアログなら Escape で閉じられるべき (modal が優先, 入力中でも効く位置)
  if(overlayOpen()) return; // 浮層が開いている間は背後の答題へキーを流さない（キー操作は浮層の中で完結させる）
  const tg=(e.target&&e.target.tagName||'').toLowerCase();
  if(tg==='textarea'||tg==='input'||tg==='select'||(e.target&&e.target.isContentEditable)) return; // 输入中不劫持数字/回车
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  if(!App.session || !document.querySelector('.runner')) return; // 仅在答题视图生效
  const q=App.session.list[App.session.pos]; if(!q) return;
  const h=KEYS[q.type]; if(!h) return; // 未知题型: 优雅跳过(不崩溃)
  if(/^[1-9]$/.test(e.key)){ if(h.onDigit && h.onDigit(q,parseInt(e.key,10))) e.preventDefault(); }
  else if(e.key==='Enter'){ // Tab で移ってきたボタン類なら Enter はそのボタンへ（ブラウザの既定のまま）：選択肢・前へ・採点する・★・自信がない・題番号などで「次へ」に奪われていた（B-041）
    // 指で押したボタンに焦点が残っている（Chromium）：Enter はボタンへ渡さない。翻页できればする・できなければ何もしない（未作答の練習で ★・自信がない を黙って反転させない：CR433-30）。リンクは止めない（CR433-32）
    if(focusOnControl(e.target)) return; const fc=focusControl(e.target); if(fc && !fc.matches('a[href], [role="link"]')) e.preventDefault(); if(h.onEnter && h.onEnter(q)) e.preventDefault(); }
  else if(e.key==='ArrowLeft'){ if(App.session.pos>0){ goPrev(); e.preventDefault(); } }
  else if(e.key==='ArrowRight'){ if(App.session.mode==='exam'&&App.session.phase==='answering'){ if(App.session.pos<App.session.list.length-1){ goNext(); e.preventDefault(); } return; } const st=App.session.perItem[q.id]; const ready=(q.type==='choice'?(st&&st.answered):(st&&st.revealed))||App.session.pos<(App.session.frontier||0); if(ready){ goNext(); e.preventDefault(); } }
}
function examLeave(){ // 模試を中断して離れる（leaveAsk で確かめた後：4.3.3 #26・CR433-19 必修 2）。exitToHome と同じ後始末（計時を止めて保存・会話を消す）に、模試の画面帧（runner・examGrading・result）を棧から外すのを足す：
  // 行き先（検索・読本・talk の先・課の入口）で品牌を押しても模試の確認が出ない・「戻る」で死んだ模試の画面に戻らない。行き先は呼び手が描く
  if(!App.session) return;
  examDropClean(); pauseSessionClock(App.session); clearCareTimer(); clearRunnerTimer(); App.session=null; App.readerReturn=null;
  const keep=viewStack.filter(function(f){ return f.key!=='runner' && f.key!=='examGrading' && f.key!=='result'; });
  if(keep.length!==viewStack.length){ viewStack=keep.length?keep:[{key:'home',render:renderHome}]; currentView=viewStack[viewStack.length-1].render; navGen++; }
  const seq=frameSeq; setTimeout(function(){ examLeaveSettle(seq); },0); // 行き先が描かれなかったとき（続く確認を取り消した・課の読み込みに失敗した・切替の途中だった）に、失効した模試の画面を残さない（CR433-24）
}
function examLeaveSettle(seq){ if(!App.session && (document.querySelector('#view .runner, #view .grading') || frameSeq===seq)) goHome(); } // 会話を消した後に画面が一つも描かれていない＝行き先が落ちなかった：読本・概念ページから離れて、続く確認を取り消したときも（CR433-40 必修 3） // 会話は無いのに作答・判分の画面が出たまま＝行き先が落ちなかった：首页へ（画面と棧を合わせる）
function exitToHome(){ examDropClean(); pauseSessionClock(App.session); clearCareTimer(); clearRunnerTimer(); App.session=null; App.readerReturn=null; goHome(); } // 離脱前に時計を停止=累計確定(exam は persist)。ホーム = 常に主頁(手册発でも誤解を避ける); 上一頁(reader)は「戻る」で
function backToReader(){ backToReaderAt(App.readerReturn); } // 引数を取らない（onclick に直接渡されて MouseEvent が入っても使わない）
// r＝戻る先。離れる確認（leaveAsk→examLeave）は App.readerReturn を消すので、確かめる前に取っておいた値で戻る（CR433-40 必修 1）
function backToReaderAt(r){ if(!r) return exitToHome(); examDropClean(); pauseSessionClock(App.session); App.readerReturn=null; App.session=null; clearCareTimer(); clearRunnerTimer();
  /* newSession() が baseHome() でスタックを [home] に潰し、その上に runner が積まれる。
   * ここで reader を積むと [home, runner, reader] になり、次の「戻る」が session=null の runner を
   * 再生して画面が固まる(その状態で目次を押すと TypeError)。スタックを [home] に戻してから reader を積む。 */
  baseHome(); navDir='back';
  renderReader(r.kai,r.sec); }
function sessionBackBtn(){ return App.readerReturn ? el('button',{class:'qback jp',html:'‹ '+t('back'),onclick:function(){ const r=App.readerReturn; leaveGuard(function(){ backToReaderAt(r); }); }}) : null; } // 手册発 session のみ左上に「戻る」。navBack を経ない。readerReturn は startPracticeIds（練習）だけが置くので模試には出ないが、出ても確かめる（CR433-19 必修 3）
function renderRunner(){
  const s=App.session;
  if(!s){
    /* 保険: 死んだ runner フレームが再生された時だけ、そのフレームを畳んでさらに戻る。
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
  const timerEl=(s.mode==='exam')?el('span',{class:'qtimer'}):null;
  body.appendChild(el('div',{class:'qhd'},[
    el('div',{class:'qhd-l'},[ el('button',{class:'qhome jp',text:'‹ '+t('home'),onclick:function(){ leaveGuard(exitToHome); }}), sessionBackBtn(), el('div',{class:'crs jp'},[ el('span',{class:'qmode',text:modeLabel()}), el('b',{text:L(App.course.title)}) ]) ]), // 戻る類は左上にそろえる（S6 U-68）
    timerEl
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
  let bar=null;
  if(body.querySelector('.reveal')){ bar=runnerBar(q); body.classList.add('has-bar'); // 答えたあと：判定＋前後の操作条（文書の流れの中）
    if(q.type==='choice') body.insertBefore(bar,body.querySelector('.reveal')); else body.appendChild(bar); } // 選択式：操作条は選択肢の直後、解説はその後（B1 几何：「次へ」が解説の下に沈まない）。記述式は自己採点の後
  if(qStep!=='none'){ body.classList.add(qStep==='next'?'qstep-next':'qstep-prev'); qStep='none'; }
  runner.appendChild(body);
  registerFrame(renderRunner,'runner'); // 先注册帧(定方向), 再 setView(套动画)
  setView(runner);
  if(bar && q.type==='choice'){ runnerBarClear(body,bar); if(typeof rxOkChip==='function') rxOkChip(body,bar); }
  if(bar){ runnerBarWatch(bar); runnerBarStuck(); requestAnimationFrame(runnerBarStuck); } // 作答瞬間はページを動かさない（B1 几何：V-16 の上滚を去る）。吸底の操作条が所選肢を覆うなら流れに戻す（V-12 と同じ規則）。正解の肢が視口外なら判定に「正解：X」の札（新課と同じ部品）
  clearRunnerTimer();
  if(timerEl) startRunnerTimer(timerEl);
}
function runnerBarWatch(bar){ // 吸底の判定は哨兵＋IntersectionObserver（新課 rxFootWatch と同じ：視口の高さ・工具欄に依らない：CR432d-5）
  if(App._qnavIO){ App._qnavIO.disconnect(); App._qnavIO=null; }
  if(bar.nextElementSibling && bar.nextElementSibling.classList.contains('qnav-s')) bar.nextElementSibling.remove();
  const s=el('div',{class:'qnav-s','aria-hidden':'true'}); bar.insertAdjacentElement('afterend',s);
  if(typeof IntersectionObserver==='undefined'){ App._qnavBelow=null; return; }
  App._qnavBelow=false;
  App._qnavIO=new IntersectionObserver(function(es){ const e=es[es.length-1]; App._qnavBelow=!e.isIntersecting && e.boundingClientRect.top>=0; runnerBarStuck(); });
  App._qnavIO.observe(s);
}
function runnerBarStuck(){ // 操作条（.qnav）が画面下に吸い付いているときだけ .stuck（下へ伸びる裙は吸い付いているときだけ：S2 10-18）
  const bar=document.querySelector('#view .runner .qnav'); if(!bar) return; let below=App._qnavBelow; if(below==null){ const r=bar.getBoundingClientRect(); below=r.bottom>=innerHeight-2 && r.top<innerHeight; }
  const stuck=getComputedStyle(bar).position==='sticky' && !!below; bar.classList.toggle('stuck',stuck);
}
window.addEventListener('scroll',runnerBarStuck,{passive:true}); window.addEventListener('resize',runnerBarStuck);
function runnerBarClear(body,bar){ // 吸底の操作条（.qnav）が、押したばかりの肢（aria-pressed）を覆うなら、流れに戻す（位移 0・覆わない：新課 rxFootClear と同じ規則）
  bar.classList.remove('flow'); if(getComputedStyle(bar).position!=='sticky') return;
  const picked=body.querySelector('.opts .opt[aria-pressed="true"]'); if(!picked) return;
  const fr=bar.getBoundingClientRect(), r=picked.getBoundingClientRect();
  if(r.bottom>fr.top+1 && r.top<fr.bottom-1) bar.classList.add('flow');
}
function runnerBar(q){ // 新課の .rx-run-f と同じ作り：左＝判定（正解／不正解・role=status）、右＝前後キー。記述は判定なし（自己採点の達成率は本文に）
  const nav=navRowNode(), st=(App.session.perItem||{})[q.id]||{};
  if(q.type==='choice' && st.answered){
    const dk=(st.picked==null), cls=dk?(feat('spaced')?'dk':'no'):(st.correct?'ok':'no');
    nav.insertBefore(el('div',{class:'rx-verdict jp '+cls,role:'status',text:dk&&feat('spaced')?t('rxDkVerdict'):(st.correct?t('rxRight'):t('rxMissed'))}),nav.firstChild);
    nav.classList.add('has-v');
  }
  return nav;
}
function modeLabel(){ const m=App.session.mode; return m==='spaced'?t('rxReviewToday'):m==='exam'?t('modeExam'):m==='wrong'?t('modeWrong'):m==='weak'?t('modeWeak'):t('modePractice'); } // U-91: 首页の「復習」tab（読む）と混同しないよう演習に
function qShowKai(q){ return (q&&(q.content_kai||q.kai||(q.source&&q.source.kai)))||null; } // 表示する回＝内容の回（神経は配布の回と内容の回が違う：一覧・作答・回末リンクで揃える。Codex 复查 U-15）
function typeLabel(type){ return type==='subjective'?t('typeSubj'):t('typeChoice'); }

function buildRail(currentQ){
  const rail=el('div',{class:'rail'},[ el('div',{class:'rk',text:t('railKai')}) ]);
  App.idx.kais.forEach(function(kai){
    const ids=App.idx.kaiToQuestions[kai]||[];
    const allSeen=ids.length>0 && ids.every(id=>App.progress.seen[id]);
    const tab=el('div',{class:'tab'+(kai===currentQ.kai?' on':''),text:String(kai)});
    if(allSeen) tab.appendChild(el('span',{class:'done',text:'✓'}));
    rail.appendChild(tab); // 答題中は現在地の表示のみ（クリック不可）
  });
  return rail;
}

function renderChoiceBody(q,body){
  const s=App.session; const st=s.perItem[q.id]||(s.perItem[q.id]={});
  const opts = st.order || (st.order=C.shuffleOptions(q.options,App.rng));
  const optsWrap=el('div',{class:'opts'});
  opts.forEach(function(o,oi){
    const btn=el('button',{class:'opt jp','aria-pressed':String(st&&st.picked===o)},[ el('span',{class:'mk',text:'ABCDEF'[oi]||''}), el('span',{text:o.t}) ]);
    if(st.answered){
      btn.disabled=true;
      if(o.correct){ btn.classList.add('ok'); btn.appendChild(el('span',{class:'lbl',text:feat('optionMarks')?t('optAns'):t('correct')})); } // 選択肢の身分（スイッチ off は 4.0.0 の表示：X16-05）
      else if(st.picked===o){ btn.classList.add('no'); btn.appendChild(el('span',{class:'lbl',text:feat('optionMarks')?t('optPicked'):t('wrong')+t('picked')})); } // 自分で選んだ誤りの選択肢（wrong・picked は作答結果・批改卡の注記に別用途がある）
      else if(feat('optionMarks')){ btn.classList.add('dim'); btn.appendChild(el('span',{class:'lbl',text:t('optNotAns')})); } // 逐肢：旧課の選択肢は {t,correct} だけ＝正解かどうかしか言えない（錯因は作らない）
    } else {
      btn.addEventListener('click',function(){ answerChoice(q,o); });
    }
    optsWrap.appendChild(btn);
  });
  body.appendChild(optsWrap);
  if(!st.answered && s.mode!=='exam' && feat('answerFirst')) body.appendChild(rxAnswerAids({st:st},function(){ answerChoice(q,null); })); // 先答後看：「わからない」は誤答として記録
  if(st.answered){
    if(s._pulse && s._pulse.id===q.id){ const tgt=s._pulse.kind==='ok'?optsWrap.querySelector('.opt.ok'):optsWrap.querySelector('.opt.no'); if(tgt) tgt.classList.add(s._pulse.kind==='ok'?'settle':'nudge'); s._pulse=null; }
    body.appendChild(buildReveal(q,false));
  }
}
function answerChoice(q,o){ if(!canWrite() || quotaStopped()) return; if(!quotaAdmit) return quotaAdmitted(answerChoice,this,arguments); // 90% 以上は判定も出さず受け付けない（WLR1 WL-08）。準入したら一笔を割らずに書く（WLR2 必修 2）
  const s=App.session;
  if(s.mode==='exam' && s.phase==='answering'){ if(overlayOpen()) return; const est=s.perItem[q.id]||(s.perItem[q.id]={uncertain:false}); const oi=q.options.indexOf(o); est.picked=(est.picked===oi)?null:oi; const okx=persistExam()!==false; if(!examPaintChoice(q,est)){ keepScroll=true; renderRunner(); } if(!okx) pulseWriterBanner(); return; } // 保存できなければ記憶に残し帯を閃かせる（X15d-01・N-E）
  const st=s.perItem[q.id];
  const correct=o?C.gradeChoice(o):false; // o＝null は「わからない」
  st.answered=true; st.picked=o; st.correct=correct;
  s.streak = correct ? ((s.streak||0)+1) : 0;
  s.answeredCount=(s.answeredCount||0)+1; s.recentWindow=s.recentWindow||[]; s.recentWindow.push(!!correct); if(s.recentWindow.length>8) s.recentWindow.shift(); // care:里程碑 + 错误聚集窗
  spRecord([{id:q.id,ok:correct,unsure:!!st.unsure}]); // 間隔復習（記録前の誤答集合で初期化するため、recordAttempt より先）
  recordAttempt(q,{type:'choice',correct:correct,ans:{selectedOption:o}});
  pushRecent(q.id);
  if(s.mode!=='exam') s._pulse={id:q.id,kind:correct?'ok':'no'}; // 练习即时反馈; 模考不置
  if(s.mode==='exam') persistExam();
  keepScroll=true; renderRunner(); // 练习揭示就地展开 → 保位不滚顶 (修「滚动后点选项」顶栏闪 + 不跳回顶部)
}

function renderSubjectiveBody(q,body,readOnly){
  const s=App.session; const st=s.perItem[q.id]||(s.perItem[q.id]={});
  if(!st.revealed && !readOnly){
    const wrap=el('div',{class:'ta-wrap'});
    const ta=el('textarea',{class:'answer jp',placeholder:t('subjPh')});
    ta.value=st.raw||'';
    ta.addEventListener('input',()=>{ st.raw=ta.value; });
    wrap.appendChild(ta);
    body.appendChild(wrap);
    body.appendChild(el('button',{class:'btn',text:t('reveal'),onclick:function(){ if(writerPreparing){ prepNotice(); return; } st.revealed=true; st.raw=ta.value; st.checked=st.checked||{}; if(s.mode!=='exam'){ s.answeredCount=(s.answeredCount||0)+1; } keepScroll=true; renderRunner(); }}));
    if(s.mode!=='exam' && feat('answerFirst')) body.appendChild(rxAnswerAids({st:st},function(){ if(!subjUnknown(q,st,s,ta.value)) return; keepScroll=true; renderRunner(); })); // 「わからない」
    return;
  }
  if(st.raw && st.raw.trim()) body.appendChild(el('div',{class:'ta-ro'},[ el('div',{class:'tl',text:t('yourAns')}), el('p',{text:st.raw}) ]));
  body.appendChild(el('div',{class:'exblock model',style:'margin-top:6px'},[ el('div',{class:'exhd',text:t('model')}), richExplain(L(q.modelAnswer), qTerms(q)) ]));
  body.appendChild(el('div',{class:'rubt jp',text:t('rubricHint')}));
  st.checked=st.checked||{};
  q.rubric.forEach(function(rb,i){
    const on=!!st.checked[i];
    const row=el('button',{class:'rb'+(on?' hit':'')},[
      el('span',{class:'ck',text:on?'✓':''}),
      el('div',null,[ el('div',{class:'rt jp',text:L(rb.point)}),
        el('span',{class:'rb-st',text:(on?'✓ '+t('hitConcept'):'○ '+t('missConcept'))+' · '+rb.concept}) ])
    ]);
    if(!readOnly) row.addEventListener('click',function(){ const y=window.scrollY; if(!rubricToggle(q,st,i)) return; renderRunner(); window.scrollTo(0,y); });
    body.appendChild(row);
  });
  const total=q.rubric.length, hit=Object.values(st.checked).filter(Boolean).length;
  const pct=Math.round(C.subjectivePercent(hit,total)*100);
  body.appendChild(el('div',{class:'scoreline jp'},[ document.createTextNode(t('achieve')+'  '), el('b',{text:pct+'%'}), document.createTextNode('  （'+tf('ptsOf',{total:total,u:t('ofPoints'),hit:hit})+'）') ]));
  body.appendChild(buildReveal(q,false));
}
function rubricToggle(q,st,i){ if(!canWrite() || quotaStopped()) return false; st.checked[i]=!st.checked[i]; commitSubjective(q); return true; } // 自己採点の要点を切り替えて記録。停記中・書けない（只読・準備中）ときは記憶も切り替えない（得点＝判定を見せたのに保存されていない、を作らない：WLR2 応修 5・快审第四十九批 第 5 条。只読の説明は canWrite が出す）
function subjUnknown(q,st,s,raw){ if(!canWrite() || quotaStopped()) return false; // 「わからない」：何も当てはまらない自己採点として記録してから答えを開く（あとで要点を押せば上書き）。停記中は開かない（WLR2 応修 5）
  st.revealed=true; st.raw=raw; st.checked={}; s.answeredCount=(s.answeredCount||0)+1; commitSubjective(q); return true; }
function commitSubjective(q){ if(!canWrite() || quotaStopped()) return; if(!quotaAdmit) return quotaAdmitted(commitSubjective,this,arguments); // 90% 以上は受け付けない（WLR1 WL-08）。準入したら一笔を割らずに書く（WLR2 必修 2）
  const s=App.session; const st=s.perItem[q.id];
  const total=q.rubric.length, hit=Object.values(st.checked).filter(Boolean).length;
  const missed=[]; q.rubric.forEach((rb,i)=>{ if(!st.checked[i]) missed.push(rb.concept); });
  st.percent=C.subjectivePercent(hit,total); st.missed=missed; st.correct=(hit===total); st.answered=true;
  if(s.mode!=='exam'){ // 自己採点は押すたびに提出される：同じ作答は「作答前の状態」から計算し直す（何度押しても一回分）
    if(!('spBase' in st) && spReadable()){ st.spBase=spItem(q.id); st.spGen=writerGen; } // 調度が読めないときは作答前の値を取らない（作った初期値を土台にして存档を覆わない：N5-02）。そのときは下の spRecord が書かずに知らせる
    const x={id:q.id,ok:st.correct,unsure:!!st.unsure}; if('spBase' in st){ x.base=st.spBase; x.inst=st; }
    if(!('spBase' in st) || st.spGen===writerGen) spRecord([x]); // X16-02：書き手が替わった後は、この作答の快照で他の書き手の新しい記録を上書きしない（この作答の記録は交代前のまま）
  }
  recordAttempt(q,{type:'subjective',correct:st.correct,percent:st.percent,ans:{checkedConcepts:[],missedConcepts:missed},raw:st.raw});
  pushRecent(q.id);
  if(s.mode==='exam') persistExam();
}

/* reveal layer (breadcrumb + tags + explain + provenance) */
function pick(arr){ return (Array.isArray(arr)&&arr.length)?arr[Math.floor(Math.random()*arr.length)]:''; }
function greetMsg(){ const p=t('greetPool'); return (Array.isArray(p)&&p.length)?pick(p):t('greet'); }
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
  const crumb=el('div',{class:'crumb'},[ el('span',{class:'jp2',text:t('crumbCourse')}), el('span',{class:'sep',text:'›'}),
    el('b',{text:tf('kaiTag',{n:qShowKai(q)})}), el('span',{class:'jp2',text:(q.source.section||'')}) ]);
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
        step.appendChild(el('span',{class:'og',text:tf('kaiTag',{n:meta.origin.kai})+' · '+(meta.origin.section||'').split(' ')[0]}));
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
  return wrap; // 前後キーの列は renderRunner が本文の末尾に操作条として付ける（收尾清单 二）
}
function goNext(){
  const s=App.session;
  if(s.mode==='exam'){ if(s.pos<s.list.length-1){ s.pos++; if(s.frontier==null||s.pos>s.frontier) s.frontier=s.pos; persistExam(); qStep='next'; renderRunner(); } return; }
  const np=s.pos+1; if(np>(s.frontier||0)) s.frontier=np;
  if(s.pos<s.list.length-1){ s.pos=np; qStep='next'; renderRunner(); }
  else finishSession();
}
function goPrev(){ const s=App.session; if(s.pos>0){ s.pos--; if(s.mode==='exam') persistExam(); qStep='prev'; renderRunner(); } }

function recordAttempt(q,info,opt){
  App.progress.seen[q.id]=true;
  const wasWrong = info.correct!==true;
  if(wasWrong) App.progress.wrong[q.id]=true; else delete App.progress.wrong[q.id];
  const h=C.types[q.type];
  if(h){ const cs=h.weaknessExtract(q,info.ans,info.correct)||[]; cs.forEach(c=>{ App.progress.weakness[c]=(App.progress.weakness[c]||0)+1; }); }
  App.progress.attempts.push({id:q.id,type:q.type,correct:info.correct,percent:info.percent,at:Date.now(),
    missedConcepts:info.ans&&info.ans.missedConcepts, rawAnswer:info.raw});
  if(App.progress.attempts.length>2000) App.progress.attempts.splice(0,App.progress.attempts.length-2000);
  if(!(opt&&opt.defer) && saveProgress()===false){ App.unsavedAns=App.unsavedAns||{}; App.unsavedAns[q.id]=1; pulseWriterBanner(); } // 記録できなかった作答ごとに帯を閃かせる（N-E）。読み直しで消えるときに件数を知らせる（総指揮裁定）
}

/* ===== 旧課の間隔復習（S1-d・スイッチ spaced） =====
 * 単位は題（旧課には命題の層がない）。規則は新課と同じ RX.schedUpdate（規範 §3.5）。
 * 保存先は quiz:<id>:sched だけで、progress の構造は変えない（旧版はこの鍵を読まないので、そのまま戻せる）。
 * 鍵がまだ無いときは「間違えた問題（progress.wrong）が今日の復習に入っている状態」とみなし、最初に記録するときに初めて書く。
 * 開くだけでは何も書かないので、何度開いても結果は同じ。書くときは毎回読み直し、書いたあと読み戻して確かめる（新課 rxSchedRecord と同じ）。 */
function spObj(v){ return !!v && typeof v==='object' && !Array.isArray(v); }
function spItemOk(x){ return spObj(x) && ['box','due','streak','wrong','unsure','seen'].every(function(k){ return Number.isInteger(x[k]) && x[k]>=0; })
  && x.box<RX.INTERVALS.length && (x.lastOkDay===null || (Number.isInteger(x.lastOkDay) && x.lastOkDay>=0)) && typeof x.mastered==='boolean'; } // 型と範囲（X16-03：box は段数の内・回数と日は 0 以上）
function spValidStored(v){ return spObj(v) && v.v===1 && spObj(v.items) && Object.keys(v.items).every(function(k){ return spItemOk(v.items[k]); }); } // 取り込み時の型検査（壊れたものは丸ごと拒む）
function spState(raw,wrong,today){ // 保存済み（壊れた項目だけ捨てる）か、まだ無ければ初期状態（間違えた問題＝今日）
  if(spObj(raw) && spObj(raw.items)){
    const items={}; Object.keys(raw.items).forEach(function(k){ if(spItemOk(raw.items[k])) items[k]=raw.items[k]; });
    return {v:1, items:items, seeded:raw.seeded||null};
  }
  const items={};
  Object.keys(spObj(wrong)?wrong:{}).forEach(function(id){ items[id]={box:0,due:today,streak:0,lastOkDay:null,mastered:false,wrong:1,unsure:0,seen:1}; });
  return {v:1, items:items, seeded:{at:Date.now(), from:'wrong', n:Object.keys(items).length}};
}
function spReadable(){ const st=lsRead5(nk('sched'),function(v){ return spObj(v) && v.v===1 && spObj(v.items) && Object.keys(v.items).every(function(k){ return spItemOk(v.items[k]); }); }).st; return st==='none' || st==='ok'; } // 調度に書いてよいか：無いか、読めて形が正しく版が 1 のとき（読めない・壊れている・形や版が分からないのは「無い」ではない：CR-19・CR-28・五態の厳格な読み・WLR1 WL-03） // 第三半（WLR1 WL-03・待定）：中の項目が一つでも認識できなければ書かない（4.2.0 は壊れた項目だけ捨てて書き戻していた）
function spLoad(){ return spState(lsGet(nk('sched'),null),(App.progress&&App.progress.wrong)||{},RX.dayIndex(new Date())); }
/* 期限が来た題：いまの題集にあり（has）、模試で隔離されていない（ql）もの。今日の復習の列と切替の浮きの件数が同じ規則で数える（X12-01 と同じ教訓） */
function spDueIds(sc,has,ql,today){ return Object.keys(sc.items).filter(function(id){ return has(id) && ql.indexOf(id)<0 && sc.items[id].due<=today; }); }
function examQuarantine(s){ return (s && s.iv===2 && (s.phase==='answering'||s.phase==='grading') && Array.isArray(s.ids))?s.ids:[]; } // readExam と同じ判定（生の値から）
function spCourseDue(c){ // 切替の浮き用：その旧課の今日の件数。題集の ID がまだ無ければ null（件数を出さない）
  const has=(App.course && App.course.id===c.id && App.idx)?function(id){ return !!App.idx.byId[id]; }:(App.oldIds && App.oldIds[c.id])?function(id){ return !!App.oldIds[c.id][id]; }:null;
  if(!has) return null;
  const rd=function(k){ try{ return JSON.parse(localStorage.getItem('quiz:'+c.id+':'+k)||'null'); }catch(e){ return null; } };
  const p=rd('progress'), today=RX.dayIndex(new Date());
  return spDueIds(spState(rd('sched'),(p && p.schemaVersion===PROGRESS_SCHEMA)?p.wrong:{},today),has,examQuarantine(rd('examInProgress')),today).length;
}
function spPrefetchIds(){ // ほかの旧課の題 ID を背景で取る（切替の浮きの件数用。取れたら該当の行だけ差し替える）
  App.oldIds=App.oldIds||{};
  courseList().forEach(function(c){
    if(c.contract===RX.CONTRACT || !(c.features && c.features.spaced===true) || (App.course && App.course.id===c.id) || App.oldIds[c.id]) return;
    fetchJSONv(c.dir+'/questions.json').then(function(v){
      if(!v || !Array.isArray(v.data)) return;
      const ids={}; v.data.forEach(function(q){ if(q && typeof q.id==='string') ids[q.id]=true; });
      App.oldIds[c.id]=ids; rxCourseRowRefresh(c.id);
    }).catch(function(){});
  });
}
function spItem(id){ const x=spLoad().items[id]; return x?Object.assign({},x):null; }
function spRecord(list,pre){ // list：[{id, ok, unsure, base?, inst?}]。base＝その作答の直前の状態。pre＝呼び出し側が先に読んだ状態。inst＝同じ作答の入れ物（自己採点の押し直し）
  if(!feat('spaced') || !list.length) return false;
  if(!spReadable()) return dataBad(nk('sched')); // 読めない・壊れた調度には書かない：作った初期値で存档を覆わない（CR-19・CR-28・五態の厳格な読み）
  const cur=pre||spLoad(), today=RX.dayIndex(new Date()), prev={};
  list.forEach(function(x){ prev[x.id]=('base' in x)?x.base:cur.items[x.id]; cur.items[x.id]=RX.schedUpdate(prev[x.id],!!x.ok,!!x.unsure,today); });
  const wrote=lsSet(nk('sched'),{v:1, items:cur.items, seeded:cur.seeded}); // 書けなければ lsSet が未保存を記す（書き手のとき）
  const back=wrote?lsGet(nk('sched'),null):null; // 読み返しで投げたら null（lsGet が受ける）
  const ok=!!(back && spObj(back.items) && list.every(function(x){ return spSame(back.items[x.id],cur.items[x.id]); })); // 形だけでなく今回の値と一致して初めて確認（X17-02）
  if(wrote && !ok) noteSave(nk('sched'),false); // 書けたのに確かめられない：未保存として知らせる（X17-02・03）
  if(!ok) pulseWriterBanner(); // 記録できなかった作答ごとに帯を閃かせる（N-E）
  list.forEach(function(x){ spWeakDecay(x,spSpacedOk(prev[x.id],cur.items[x.id],!!x.ok,!!x.unsure,today),ok); }); // 減らすのは確認できたときだけ、戻すのは無条件（B-004・X17-03）
  return ok;
}
function spSame(a,b){ return !!(spItemOk(a) && b) && ['box','due','streak','lastOkDay','mastered','wrong','unsure','seen'].every(function(k){ return a[k]===b[k]; }); }
/* B-004 苦手の間隔衰減（総指揮 2026-10-12 定）：間隔正答＝未習得から習得へ（隔日で二度正答）、または習得済みで期限後に正答（間隔が一段延びる）。
 * そのたびにその題の概念（記述は要点の概念）を一つずつ減らし、0 で苦手から外す。同じ日の重ね答え・「自信なし」の正答は減らさない。
 * 進度（weakness）はこのあと recordAttempt／saveProgress が同じ作答の記録と一緒に書く。spaced が off なら spRecord が何もしないので 4.0.0 と同じ */
function spSpacedOk(prev,next,ok,unsure,today){ if(!ok || unsure || !next) return false; if(prev && prev.mastered) return today>=prev.due; return !!next.mastered; }
function spConcepts(q){ return q.type==='subjective'?(q.rubric||[]).map(function(rb){ return rb.concept; }).filter(Boolean):(q.concepts||[]).slice(); }
function spWeakDecay(x,hit,confirmed){ // 同じ作答（inst）は下げた概念を覚えて一回分だけ：押し直しで間隔正答でなくなれば戻す。減らすのは sched を確認できたときだけ、戻すのは無条件（どの故障でも少なく減らすだけ）
  const q=App.idx.byId[x.id], w=App.progress.weakness, inst=x.inst||{}; if(!q || !w) return;
  if(hit && !inst.spDec && confirmed){ inst.spDec=spConcepts(q).filter(function(c,i,a){ return w[c]>0 && a.indexOf(c)===i; }); inst.spDec.forEach(function(c){ if(!--w[c]) delete w[c]; }); }
  else if(!hit && inst.spDec){ inst.spDec.forEach(function(c){ w[c]=(w[c]||0)+1; }); delete inst.spDec; }
}
function spQueue(){ // 今日の復習：期限が来た題のうち、いまの題集にあって模試で隔離されていないもの。試験日まで 14 日以内は個人の重点（誤答・自信なし）が先
  const sc=spLoad(), today=RX.dayIndex(new Date()), ed=rxExamDay();
  const sprint=(ed!==null && ed>=today && ed-today<=14);
  const mine=function(id){ const x=sc.items[id]; return (!x.mastered && (x.wrong>0 || x.unsure>0))?0:1; };
  return spDueIds(sc,function(id){ return !!App.idx.byId[id]; },quarantinedIds()||[],today)
    .sort(function(a,b){ return (sprint?mine(a)-mine(b):0) || sc.items[a].due-sc.items[b].due || sc.items[b].wrong-sc.items[a].wrong || (a<b?-1:1); });
}
function spReviewRun(){ leaveGuard(function(){ const list=spQueue().slice(0,20).map(function(id){ return App.idx.byId[id]; }); if(newSession('spaced',list,{})) renderRunner(); }); } // 練習の最中（読本・概念ページへ移った先も）なら確かめてから：黙って置き換えると今の練習が消える（4.3.3 #30・CR433-40 必修 2）
function spHomeNode(){ // 旧課ホーム（演習タブ）の「今日の復習」
  const n=spQueue().length;
  if(!n) return el('div',{class:'subrow sdr-row'},[ reviewDoneNode() ]); // 無いときは押せないカードではなく完了の一行（新課と同じ：U-52）
  const f=flagNode({pill:t('rxFlagReviewPill'),title:t('rxReviewToday'),desc:tf('rxReviewN',{n:n}),cta:t('rxFlagReviewCta'),onCta:spReviewRun}); // #37 C（Q-075）：電脳は模試の旗卡と同じ部品（標籤／見出し／件数／鈕）、鍵は新課の旗卡と同じ四つ；押せるのは鈕だけ、動作は従来の小卡と同じ spReviewRun
  f.classList.add('sdr-due','sdr-wide'); // 印は従来どおり（契約 U52e・HOME04 が見る）；.sdr-wide＝≥1024 だけ表示
  const ti=f.querySelector('.fti'), de=f.querySelector('.fde'), cta=f.querySelector('.fcta'); if(ti&&de&&cta){ ti.id='sdr-due-t'; de.id='sdr-due-n'; cta.setAttribute('aria-describedby','sdr-due-t sdr-due-n'); } // 鈕の読み上げに見出し（今日の復習）と件数を添える（CR433-35 順手）
  if(typeof examResumable==='function' && examResumable()) f.appendChild(el('div',{class:'ffoot ffoot-ghost','aria-hidden':'true'},[ el('span',{class:'fchip jp',text:t('examOverwriteOk')}) ])); // 中断した模試があると模試の旗卡に尾行（「最初から」の chip）が付く：同じ高さの幽霊（見えず・読まれず・Tab 不可）を置いて二つの主鈕の底を揃える（CR433-35 F-01）
  const b=el('button',{class:'subcard sdr-due sdr-compact',onclick:spReviewRun},[ el('span',{class:'scic',html:NEW_ICONS.refresh}), // Q-076：手机（<1024）は従来の一行の小卡のまま（CSS で切り替え、再描画は要らない）
    el('span',{class:'sctx'},[ el('b',{class:'jp',text:t('rxReviewToday')}), el('small',{class:'jp',text:tf('rxReviewN',{n:n})}) ]) ]);
  return el('div',{class:'subrow sdr-row'},[ b, f ]);
}

function finishSession(){
  clearCareTimer(); clearRunnerTimer();
  const s=App.session;
  if(s.mode==='exam') return renderGrading(); // 模試の結果は定稿（finalizeExam）だけが作る。ここは普通の画面からは到らない死路だったが、進度を書いて模試の記録を消していた：万一到っても何も書かず採点へ（WLR1）
  const log=[]; s.list.forEach(function(q){ const st=s.perItem[q.id]; if(st&&st.answered){
    log.push({id:q.id,type:q.type,correct:st.correct,ans:{missedConcepts:st.missed}}); } });
  const agg=C.aggregateWeakness(log,App.idx.byId);
  baseHome(); // 结果坐落在 [home, result]: 返回回首页(无法退回已结束的答题)
  App._bloom=true; // 练习结果径向（模試はここに来ない）
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
  card.appendChild(el('div',{class:'dsub1 jp',text:t('resSub').replace('{m}',App.session.mode==='exam'?t('modeExam'):t('modePractice')).replace('{n}',total)}));
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
  /* 次の一歩（U-47）：実心は一つだけ。模試＝この試験の間違いを解き直す、練習＝苦手を重点的に。AI の書き出しは描边（buildAIGuidance） */
  const acts=el('div',{class:'racts1'}), exam=App.session.mode==='exam', wids=(agg.wrongIds||[]).slice();
  const prim=exam?(wids.length?el('button',{class:'btn',text:t('histRedo'),onclick:function(){ startPracticeIds(wids); }}):null):(cw.length?el('button',{class:'btn',text:t('weighted'),onclick:function(){ startWeighted(); }}):null);
  if(prim) acts.appendChild(prim);
  if(App.readerReturn) acts.appendChild(el('button',{class:'btn'+(prim?' ghost':''),text:t('back'),onclick:backToReader}));
  if(exam) acts.appendChild(el('button',{class:'btn ghost',text:t('again'),onclick:startExam}));
  if(exam) acts.appendChild(el('button',{class:'btn ghost',text:t('histTitle'),onclick:renderExamHistory}));
  if(exam && cw.length) acts.appendChild(el('button',{class:'btn ghost',text:t('weighted'),onclick:function(){ startWeighted(); }}));
  acts.appendChild(el('button',{class:'btn ghost',text:t('home'),onclick:exitToHome}));
  card.appendChild(acts);
  kids.push(card);
  setView(el('div',null,kids));
}
function statBox(n,l){ return el('div',{class:'statbox'},[ el('div',{class:'n',text:String(n)}), el('div',{class:'l jp',text:l}) ]); }
function topEntries(obj,n){ return Object.entries(obj||{}).sort((a,b)=>b[1]-a[1]).slice(0,n); }

function buildAIGuidance(){
  const box=el('div',{class:'aibox'},[ el('div',{class:'et',text:t('aiTitle')}), el('p',{class:'jp',text:t('aiResultHint')}) ]);
  const expBtn=el('button',{class:'btn ghost sm',text:t('export')}); // 結果ページの主ボタンにしない（U-47）
  expBtn.addEventListener('click',openIO);
  box.appendChild(el('div',{class:'row'},[ expBtn ]));
  return box;
}
/* ---------- rest overlay (transient, never blocks input) ---------- */
const REST_ICONS=[
  // Lucide 24-grid/currentColor/1.75(与全库图标同族同权重)。coffee
  '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2M10 2v2M14 2v2"/></svg>',
  // cat
  '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z"/><path d="M8 14v.5M16 14v.5"/><path d="M11.25 16.25h1.5L12 17z"/></svg>',
  // mountain-snow (ひと休みの風景)
  '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/><path d="M4.14 15.08c2.62-1.57 5.24-1.57 7.86 0 2.62 1.57 5.24 1.57 7.86 0"/></svg>'
];
let restTick=0;
function showRestPop(){
  try{
    const msg=pick(t('restPool')); const icon=pick(REST_ICONS); restTick++; // 每回 pick 真随机(旧: restTick 顺送り→初回が必ず restPool[0]「珈琲」に固定される不具合)
    const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rp=el('div',{class:'rp'},[ el('div',{class:'rpic',style:'display:flex;justify-content:center;line-height:0',html:icon}), el('div',{class:'rpt'},[kaoWrap(msg)]) ]);
    const host=document.querySelector('#view .card'); // 成績の上に重ねず、結果カードの下に一行で添える（成績を隠さない・消えない：S6 U-64）
    if(host){ host.appendChild(el('div',{class:'restline'},[ rp ])); return; }
    const pop=el('div',{class:'restpop'+(reduce?'':' anim')},[ rp ]);
    document.body.appendChild(pop);
    const ttl=reduce?1600:2900;
    setTimeout(function(){ if(pop&&pop.parentNode) pop.parentNode.removeChild(pop); },ttl);
  }catch(e){ /* 休息提示失败不应影响主流程 */ }
}

function startReviewKai(kai){
  const ids=App.idx.kaiToQuestions[kai]||[];
  const list=C.reviewSample(App.questions,{onlyIds:ids,count:ids.length,recentIds:App.recent},App.rng);
  leaveGuard(function(){ newSession('review',list,{kai:kai}); renderRunner(); });
}
function startWeighted(n){ // n 指定時(圆窗「10問」チップ)は題数を守約: 苦手在庫が薄ければ全体から不足分を補充
  if(!(typeof n==='number' && n>0)) n=0; // ボタンの onclick に直接渡すとクリックの event が n に入る：題数ではないので既定（12）に（B-018／X1-08：「苦手を重点的に」が始まらなかった）
  const want=(n||12);
  let list=C.reviewSample(App.questions,{weakness:App.progress.weakness,count:want,recentIds:App.recent},App.rng);
  if(n && list.length<want){
    const have={}; list.forEach(function(q){ have[q.id]=1; });
    const pad=C.reviewSample(App.questions,{count:want+8,recentIds:App.recent},App.rng)
      .filter(function(q){ return !have[q.id]; }).slice(0, want-list.length);
    list=list.concat(pad);
  }
  leaveGuard(function(){ newSession('weak',list,{}); renderRunner(); });
}
function startRandom(){
  const list=C.reviewSample(App.questions,{count:12,recentIds:App.recent},App.rng);
  leaveGuard(function(){ newSession('review',list,{}); renderRunner(); });
}

/* ---------- WRONG + WEAK merged hub: 間違い + 苦手 を一つの枢に, 分段切替, 両視図の内容は原様流用 ---------- */
function wrongBodyNodes(){ // 「間違い」子視図の本体 (sectionHead/registerFrame/setView を除く)
  const ids=Object.keys(App.progress.wrong);
  if(!ids.length){ return [ el('div',{class:'card'},[ el('p',{class:'muted jp',text:t('wrongNone')}) ]) ]; }
  const out=[];
  const top=el('div',{class:'card'},[ el('p',{class:'muted jp',text:ids.length+' '+t('q')}) ]);
  top.appendChild(el('button',{class:'btn',style:'margin-top:10px',text:t('startReview'),onclick:function(){
    const list=C.reviewSample(App.questions,{onlyIds:ids,count:Math.min(ids.length,20),weakness:App.progress.weakness,recentIds:App.recent},App.rng);
    leaveGuard(function(){ newSession('wrong',list,{}); renderRunner(); });
  }}));
  out.push(top);
  const groups={};
  ids.forEach(function(id){ const q=App.idx.byId[id]; if(!q) return; const cs=new Set();
    (q.concepts||[]).forEach(function(c){ cs.add(c); }); (q.rubric||[]).forEach(function(rb){ if(rb.concept) cs.add(rb.concept); });
    if(!cs.size) cs.add(t('groupOther')); cs.forEach(function(c){ (groups[c]=groups[c]||[]).push(id); }); });
  const ordered=Object.entries(groups).sort(function(a,b){ return b[1].length-a[1].length; });
  const card=el('div',{class:'card'});
  card.appendChild(el('div',{class:'rubt jp',text:t('wrongByConcept')}));
  ordered.forEach(function(pair){ const c=pair[0], gids=pair[1];
    card.appendChild(el('div',{class:'wgrp'},[
      el('button',{class:'wgrp-n jp',text:c,title:c,onclick:function(){ if(App.idx.conceptMeta[c]&&App.idx.conceptMeta[c].exists) renderConcept(c,{from:'wrong'}); }}),
      el('span',{class:'wgrp-c',text:gids.length+' '+t('q')}),
      el('button',{class:'btn sm ghost wgrp-go',text:t('retryGroup'),onclick:function(){
        const list=C.reviewSample(App.questions,{onlyIds:gids,count:gids.length,recentIds:App.recent},App.rng);
        leaveGuard(function(){ newSession('wrong',list,{}); renderRunner(); });
      }})
    ]));
  });
  out.push(card);
  return out;
}
function weakBodyNodes(){ // 「苦手」子視図の本体
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
  const hd=sectionHead(t('modeWrong')), h2=hd.querySelector('h2');
  const tw=el('div',{class:'sh-t'},[ el('p',{class:'sh-lede jp',text:t('wrongLede')}) ]); hd.replaceChild(tw,h2); tw.appendChild(h2); // U-91: 入口「苦手を重点的に」と页名が違うので、标题の上に一行（快审第十九批 K-21 乙案）
  const kids=[ hd ];
  if(!wrongIds.length){ // 空: 間違いがまだ無ければ苦手重点(重み付き)へ
    kids.push(el('div',{class:'card'},[ el('p',{class:'muted jp',text:t('wrongNone')}),
      el('button',{class:'btn ghost',style:'margin-top:12px',text:t('weakTile'),onclick:function(){ startWeighted(); }}) ]));
    setView(el('div',null,kids)); return;
  }
  const top=el('div',{class:'card'},[ el('p',{class:'muted jp',text:wrongIds.length+' '+t('q')}) ]);
  top.appendChild(el('button',{class:'btn',style:'margin-top:12px',text:t('wrongPractice'),onclick:function(){
    const list=C.reviewSample(App.questions,{onlyIds:wrongIds,count:Math.min(wrongIds.length,20),weakness:App.progress.weakness,recentIds:App.recent},App.rng);
    leaveGuard(function(){ newSession('wrong',list,{}); renderRunner(); });
  }}));
  kids.push(top);
  const list=el('div',{class:'card wl-list'});
  wrongIds.map(function(id){ return {q:App.idx.byId[id], n:wc[id]||1}; }).filter(function(r){ return r.q; })
    .sort(function(a,b){ return b.n-a.n; })
    .forEach(function(r){ const q=r.q;
      list.appendChild(el('button',{class:'wl-row',title:t('wrongPracticeOne'),onclick:function(){ leaveGuard(function(){ newSession('wrong',[q],{}); renderRunner(); }); }},[
        el('span',{class:'wl-kai mono',text:tf('kaiTag',{n:qShowKai(q)})}),
        el('span',{class:'wl-q jp',text:q.q}),
        el('span',{class:'wl-n mono',text:t('wrongMiss').replace('{n}',r.n)}) ]));
    });
  kids.push(list);
  setView(el('div',null,kids));
}
/* 现无 UI 入口（入口缺失，非废弃）：复活或退役待裁定，勿当死代码删除。 */
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
