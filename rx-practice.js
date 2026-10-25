/* rx-practice.js ― 新课的练法与逐肢反馈：命題○×・選択・訂正ドリル・症状→疾患・人物年代グリッド・国試形。
 * 所有练法默认遮住答案，只有「わからない」（计为答错）；每次作答可标「自信なし」。
 * 每个题项自带状态对象：跳到根拠カード再返回时按原状态重绘（作答现场保留）。 */
'use strict';

/* 作答记录：交给调度器（rx-sched）；未载入时为空操作 */
function rxRecord(ev){ if(typeof rxSchedRecord!=='function') return true; const r=rxSchedRecord(ev); if(r==='partial') toast(t('rxPartialSave')); return r!==false; } // 'partial'＝戻しも書けず一部が残った（契約外）：判題は出す（重答は求めない）が「未完整保存」を知らせ、帯は残す（合成稿 v3.3） // ev＝一笔作答の事件（配列可：一題の全命題を一つの事務で）。戻り値＝全部保存できたか（CR-07・CR-10）。失敗なら作答は待答のまま
function rxNotSaved(){ if(canWrite()) pulseWriterBanner(); } // 記録できなかった作答ごとに目に見える合図を（N-E：何度押しても画面が変わらず固まって見えた）。書き手でなくなっていれば canWrite が説明を出す
function rxW(fn){ return function(){ if(!canWrite()) return; return fn.apply(this,arguments); }; } // 作答と作答状態の変更は書き手だけ：交接の窓口期（帯が出る前の約 400ms）に判分だけ出て記録が黙って捨てられていた（CR-01）。只読なら待答のまま、説明を出す

/* ---------- 练法一览（按数据可用性） ---------- */
const RX_CAP={tf:20,fix:10,grid:15}; // 一轮的上限（入口の題数表示と出题で同じ値を使う：S6 U-89）
function rxModesFor(Lc){
  const ix=App.rx.ix, modes=[];
  const qs=(Lc.questions||[]);
  const tfN=(Lc.props||[]).length;
  if(tfN) modes.push({key:'tf',lk:'rxModeTF',label:t('rxModeTF'),n:tfN,build:function(){ return rxBuildTF(Lc); }});
  const ch=qs.filter(function(q){ return q.type==='choice'; });
  if(ch.length) modes.push({key:'choice',lk:'rxModeChoice',label:t('rxModeChoice'),n:ch.length,build:function(){ return rxShuffle(ch).map(rxQItem); }});
  const ko=qs.filter(function(q){ return q.type==='kokushi'; });
  if(ko.length) modes.push({key:'kokushi',lk:'rxModeKokushi',label:t('rxModeKokushi'),n:ko.length,build:function(){ return rxShuffle(ko).map(rxQItem); }});
  const fx=[]; (Lc.props||[]).forEach(function(p){ (p.variants||[]).forEach(function(v){ if(v.correct) fx.push({p:p,v:v}); }); });
  if(fx.length) modes.push({key:'fix',lk:'rxModeFix',label:t('rxModeFix'),n:fx.length,build:function(){ return rxShuffle(fx).slice(0,RX_CAP.fix).map(function(x){ return rxFixItem(x.p,x.v); }); }});
  const sym=rxCardsOf(Lc,'body').filter(function(c){ return (c.symptoms||[]).length; });
  if(sym.length && rxCourseCards('body').filter(function(c){ return (c.symptoms||[]).length; }).length>=2)
    modes.push({key:'sym',lk:'rxModeSym',label:t('rxModeSym'),n:sym.length,build:function(){ return rxBuildSym(sym); }});
  if(rxVaultState()==='unlocked'){
    const qz=rxQuizOf(Lc.id);
    if(qz.length) modes.push({key:'quiz',lk:'rxModeQuiz',label:t('rxModeQuiz'),n:qz.length,build:function(){ return rxShuffle(qz).map(function(q){ return rxQItem(rxQuizQ(q)); }); }});
  } else if(rxVaultState()==='locked') modes.push({key:'quiz-locked',label:t('rxModeQuiz'),n:0,locked:true});
  const grid=rxCardsOf(Lc,'timeline').filter(function(c){ return (c.rows||[]).length>=2; });
  if(grid.length) modes.push({key:'grid',lk:'rxModeGrid',label:t('rxModeGrid'),n:grid.reduce(function(a,c){ return a+c.rows.length; },0),build:function(){ return rxBuildGrid(grid); }});
  return modes;
}
function rxCardsOf(Lc,kind){ return (Lc.cards||[]).filter(function(c){ return c.kind===kind; }); }
function rxCourseCards(kind){ return App.rx.ix.lectures.reduce(function(a,L){ return a.concat(rxCardsOf(L,kind)); },[]); }
function rxShuffle(a){ const o=RX.shuffledOrder(a.length,App.rng); return o.map(function(i){ return a[i]; }); }

function rxPracticeBar(Lc){
  const modes=rxModesFor(Lc);
  if(!modes.length) return null;
  return el('section',{class:'rx-prac'},[ el('h2',{class:'rx-bh jp',text:t('rxPractice')}),
    el('div',{class:'rx-modes'},modes.map(function(m){
      if(m.locked) return el('button',{class:'rx-mode rx-mode-locked jp','data-mode':m.key,'aria-label':m.label+'（'+t('rxLocked')+'）',onclick:rxUnlockDialog},[
        el('span',{class:'rx-lock-i','aria-hidden':'true',html:NEW_ICONS.lock}), el('span',{text:m.label}) ]);
      return el('button',{class:'rx-mode jp','data-mode':m.key,onclick:function(){ rxModeStart(m,Lc); }},[
        el('span',{text:m.label}), el('span',{class:'rx-mode-n',text:rxModeCountText(m)}) ]);
    })) ]);
}

function rxModeStart(m,Lc,opt){ // 練法を一つ始める（回ページの chip と首页の練法面板で共用：Q-074）。opt.from＝'home' なら結果の戻る鈕は「ホームへ戻る」
  if(!m || m.locked || typeof m.build!=='function') return;
  rxRun(m.lk,m.build(),Lc.id,{remake:m.build,from:opt&&opt.from});
}
function rxModeCountText(m){ // U-89: 一轮に実際に出る数。上限で切られるときは全体の数も（快审第十九批 K-19）
  const k=RX_CAP[m.key]?Math.min(m.n,RX_CAP[m.key]):m.n;
  return k<m.n ? tf('rxModeCount',{k:k,n:m.n}) : tf('qCount',{n:m.n});
}

/* ---------- ランナー ---------- */
function rxRun(titleKey,items,lecId,opt){ // titleKey＝i18n の鍵：表示のたびに今の言語で引く（演習中に言語を切り替えても見出しが古い言語に残らない：S6 U-32）
  if(!items.length || !canWrite()) return; // 只读标签不开始练习（单写者）
  rxClearTimer();
  if(typeof navSkipLeave!=='undefined' && document.querySelector('#view .rx-lecture')) navSkipLeave=true; // 回ページから練習へ：旧画面を離場層に残さない（進練習の INP：272→152）
  App.rxRun={titleKey:titleKey,items:items,pos:0,lecId:lecId,cid:App.course.id,remake:(opt&&opt.remake)||null,from:(opt&&opt.from)||null, // from＝来た所（'home'＝首页から直接；結果の戻る文言に使う：Q-074） // cid＝この練習の課（限時の再試行・記録が別の課に流れないよう照合：CR-23） // remake＝同じ練法でもう一轮（結果の「もう一度」）
    deadline:(opt&&opt.secPerItem)?Date.now()+items.length*opt.secPerItem*1000:null, sec:(opt&&opt.secPerItem)||null, blind:!!(opt&&opt.blind)}; // blind＝整場盲答（期末模試：4.3.3 #11）
  rxRunRender();
}
function rxInterrupt(){ // 限時の練習中に書き手でなくなった（総指揮 2026-10-15 定 (c)）：その場で終える。計時を止め、作答の状態と時限は捨てる（書き手が替わったあとに自動で記録する道を残さない：合成稿 原則 3）。題の並びだけ残して「中断」画面から最初からやり直せる
  const R=App.rxRun; if(!R || !R.deadline || R.timedOut || R.interrupted || R.graded) return; // 採点済みの期末模試（結果・見直し）は中断しない
  rxClearTimer();
  App.rxRun={interrupted:true, titleKey:R.titleKey, lecId:R.lecId, cid:R.cid, remake:R.remake, from:R.from, sec:R.sec, blind:R.blind, items:R.items.map(rxResetItem)}; // 盲答の作答は記録前なので全部捨てる（(c) と同じ：何も記録しない）
  if(currentView===rxRunRender) rxRunRender();
}
function rxResetItem(it){ const o=it.st||{}; it.st=o.order?{order:RX.shuffledOrder(o.order.length,App.rng)}:{}; if(it.kind==='q') it.st.picked=[]; if(it.kind==='fix') it.st.text=''; return it; } // 解き直し用：作答の状態だけ白紙に（選択肢は並べ直す）
function rxClearTimer(){ if(App.rxTimer){ clearInterval(App.rxTimer); App.rxTimer=null; } }
function rxTimeLeftText(R){ const s=Math.max(0,Math.round((R.deadline-Date.now())/1000)); return t('rxTimeLeft').replace('{m}',Math.floor(s/60)).replace('{s}',String(s%60).padStart(2,'0')); }
function rxTimeUp(){ // 時間切れ：未回答は不正解として記録し、結果へ。記録が全部保存できてから時間切れを確定する（CR-12）
  const R=App.rxRun; if(!R || R.interrupted) return; // 中断した練習は記録しない
  if(R.blind && !R.graded){ rxBlindGrade(R,true); return; } // 期末模試：時間切れ＝その時点の解答で提出（未回答は不正解）
  if(!App.course || App.course.id!==R.cid){ rxClearTimer(); return; } // 別の課へ移った練習は打ち切る（CR-23）
  if(!fenceOk()){ rxClearTimer(); R.tuFail=true; rxRunRender(); return; } // 書けない（只読・準備中）：計時を止め「もう一度記録する」へ。書き手に戻っても自動では記録しない（書き手が替わった後の遅れた書き込みを作らない：WLR1 合并裁定 三-9）
  const evs=[]; R.items.forEach(function(it){ if(!it.st.done) (it.props||[]).forEach(function(pid){ evs.push({mode:'mock',props:[pid],ok:false,unsure:false}); }); });
  if(evs.length && !rxRecord(evs)){ rxClearTimer(); if(typeof rxDataNewer==='function' && rxDataNewer()){ R.newer=true; rxRunRender(); return; } R.tuFail=true; pulseWriterBanner(); rxRunRender(); return; } // 先の版の記録で書けない：押し直しても必ず失敗する＝「もう一度保存する」は出さない（CR433-10） // 保存できなければ未回答のまま計時を止め、「もう一度記録する」を出す（合成稿 v3.3：自動では試し直さない。事務は戻してあるので押し直しても二重に数えない）
  rxClearTimer(); R.tuFail=false;
  R.items.forEach(function(it){ if(!it.st.done){ it.st.done=true; it.st.ok=false; it.st.timeout=true; } });
  R.pos=R.items.length; R.timedOut=true; rxRunRender();
}
let rxStep=false; // 「次へ」から来た一回だけ、旧課 runner と同じ換題の歩み（.rbody.qstep-next）を付ける（前端計画 002）
function rxRunRender(){
  const step=rxStep; rxStep=false;
  const R=App.rxRun; if(!R){ goHome(); return; }
  registerFrame(rxRunRender,'rx-run');
  if(R.blind && R.graded && R.review!=null) return rxBlindReview(R); // 採点後の見直し（一題ずつ）
  if(R.pos>=R.items.length) return rxRunEnd();
  if(R.interrupted){ // 書き手が替わって中断した限時の練習（(c)）：未回答を時間切れとして記録はしない。最初からやり直すか離れるか
    rxClearTimer();
    setView(el('div',{class:'rx-run rbody'},[ sectionHead(t(R.titleKey),function(){ App.rxRun=null; goBack(); }),
      el('p',{class:'rx-hint jp',role:'status',text:t('rxInterrupted')}),
      el('div',{class:'row',style:'gap:10px;margin-top:12px'},[
        el('button',{class:'btn',text:t('rxRestart'),onclick:function(){ if(!canWrite()) return; rxRun(R.titleKey,R.items.map(rxResetItem),R.lecId,{remake:R.remake,secPerItem:R.sec,blind:R.blind,from:R.from}); }}), // 盲答（blind）も来た所（from）も引き継ぐ：首页から始めた模試を中断→やり直しても盲答のまま・結果は「ホームへ戻る」（#11・#40）
        el('button',{class:'btn ghost',text:t('rxLeave'),onclick:function(){ App.rxRun=null; goBack(); }}) ]) ]));
    return;
  }
  if(R.newer){ // 端末の記録が先の版：書けない（押し直しても同じ）。知らせて離れるだけ（CR433-10）
    rxClearTimer();
    setView(el('div',{class:'rx-run rbody'},[ sectionHead(t(R.titleKey),function(){ App.rxRun=null; goBack(); }),
      el('p',{class:'rx-hint jp',role:'status',text:t('dataNewer')}),
      el('button',{class:'btn ghost',text:t('rxLeave'),onclick:function(){ App.rxRun=null; goBack(); }}) ]));
    return;
  }
  if(R.tuFail){ // 時間切れの記録が保存できなかった：作答はもう受け付けず、押し直しだけを出す
    rxClearTimer();
    setView(el('div',{class:'rx-run rbody'},[ sectionHead(t(R.titleKey),function(){ App.rxRun=null; goBack(); }),
      el('p',{class:'rx-hint jp',role:'status',text:t('rxTimeUpFail')}),
      el('button',{class:'btn',text:t('rxTimeUpRetry'),onclick:function(){ if(!canWrite()) return; rxTimeUp(); }}) ])); // 書けないときは canWrite の知らせ（只読の説明・準備中）を出して何もしない（三-9）
    return;
  }
  if(R.blind) return rxBlindRender(R,step); // 期末模試：答えている間は判定・解説を出さない
  const it=R.items[R.pos];
  const body=el('div',{class:'rx-run-b',tabindex:'-1'});
  const foot=el('div',{class:'rx-run-f'+(getHand()==='left'?' lefthand':'')}); // 答えたあとの「次へ」：画面下に貼り付く（利き手の側）
  let timer=null;
  if(R.deadline){
    timer=el('span',{class:'rx-timer mono','aria-live':'off',text:rxTimeLeftText(R)});
    rxClearTimer();
    App.rxTimer=setInterval(function(){ if(App.rxRun!==R || !App.course || App.course.id!==R.cid){ rxClearTimer(); return; }
      if(Date.now()>=R.deadline){ rxTimeUp(); return; } timer.textContent=rxTimeLeftText(R); },500);
  }
  const next=function(){ const back=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('.rx-run');
    R.pos++; rxStep=true; rxRunRender(); window.scrollTo(0,0);
    if(back){ const b=document.querySelector('.rx-run-b'); if(b) b.focus({preventScroll:true}); } }; // 键盘で次へ：焦点を新しい問題へ（BODY に落とさない）
  const run=el('div',{class:'rx-run rx-q rbody'+((it.st.done && it.kind!=='q')?'':' rx-ask')+((it.st.done && it.kind==='q')?' rx-answered':'')+(step?' qstep-next':'')}); // 選択式・国試は答えたあとも rx-ask（答える前の配置を保つ）：描き直し（根拠から戻る等）でも同じ布局にする（CR432c-3：題頭の余白が消えて 366px ずれていた） // reduce は styles.css:346 の全停止で止まる
  App._rxVb={body:body,it:it,next:next}; // 固定の判定行（rxVbSync）が見る今の題
  it.render(body,function(){ rxRunFoot(foot,it,next,body); if(it.kind==='q'){ run.classList.add('rx-answered'); rxKeepOpts(body,it); rxVbSync(); rxFootClear(body,foot,it); rxOkChip(body,foot); } else run.classList.remove('rx-ask'); rxRevealed(body,foot); rxFootStuck(); requestAnimationFrame(rxFootStuck); }); // 答えて操作条に中身が入ったら、どの題型でも吸底を判定し直す（哨兵の交差は変わらないので IntersectionObserver は鳴らない：○×で .stuck が付かなかった） // 選択式・国試：答える前の配置を保ったまま（rx-ask を外さない）——ページも押した肢も動かない（S8 V-08、総指揮 (c)／(c2)）
  if(it.st.done){ rxRunFoot(foot,it,next,body); if(it.kind==='q'){ const o=body.querySelector('.opts'); if(o && it.st.keepTop && it.st.keepW===innerWidth) o.style.marginTop=it.st.keepTop+'px'; /* 幅が変わっていたら古い留白は当てない（#17⑤） */ const late=function(){ if(!body.querySelector('.rx-verdict-band .rx-ok-chip')) rxOkChip(body,foot); rxVbSync(); }; if(App._navRestoring){ requestAnimationFrame(rxVbSync); setTimeout(late,50); } else requestAnimationFrame(late); } } // 答えた題の描き直し：正解の肢が視口外なら札も出し直す（S4 10-18：WebKit で帯は視口内・正解肢は視口外なのに札が無かった）。戻る（restoreFrame）のときは位置が戻ってから判る // 答えた題の再描画：留白を再現してから、固定の判定行を評価（CR432c-3） // 答えた題の再描画（根拠のカードから戻る等）：布局・位置の復元のあとで固定の判定行を評価し直す（CR432c-3）
  [ sectionHead(t(R.titleKey),function(){ rxClearTimer(); App.rxRun=null; goBack(); }),
    el('div',{class:'qnum'},[ timer, el('span',{class:'prog',text:(R.pos+1)+' / '+R.items.length}) ].filter(Boolean)),
    body, foot ].forEach(function(n){ run.appendChild(n); });
  setView(run); rxFootWatch(foot); rxFootStuck(); requestAnimationFrame(rxFootStuck); run.addEventListener('animationend',function onEnd(e){ if(e.target!==run) return; run.removeEventListener('animationend',onEnd); rxVbSync(); rxFootStuck(); }); // 過場動画（run 自身の animation）が終わってから固定行・吸底をもう一度合わせる（動画中は祖先の transform で fixed の矩形がずれる）。子の animationend では動かない（CR432e 小修）
}
function rxRunFoot(foot,it,next,body){ // 操作条：左＝判定（role=status ごと題内から移す）・右＝次へ（利き手で鏡像）。文書の流れの中で sticky：短ければ選択肢のすぐ下、長ければ画面下に吸い付く（收尾清单 二）
  foot.innerHTML='';
  const btn=el('button',{class:'btn',text:App.rxRun.pos+1<App.rxRun.items.length?t('rxNext'):t('rxFinish'),onclick:next});
  const band=body&&body.querySelector('.rx-verdict-band:not(.rx-vb-empty)');
  if(band){ band.appendChild(btn); return; } // 選択式・国試（帳簿 A′）：「次へ」は題文の下の判定帯の右端（V-14 方向 4・Q-060）。底の操作条は空のまま非表示（帯が視口外のときは固定の一行 rxVbSync：位置が確定したあとで判る）
  const v=body&&body.querySelector('.rx-verdict'); if(v) foot.appendChild(v);
  foot.appendChild(btn);
}
/* 揭示直後：連打で新しい控件を押さないよう 300ms だけ受け付けない／判定行を見える位置へ／焦点は「次へ」へ */
function rxGuard(n){ if(!n) return; n.classList.add('rx-guard'); setTimeout(function(){ n.classList.remove('rx-guard'); },300); }
function rxRevealed(body,foot){
  rxGuard(body); rxGuard(foot);
  const b=foot.querySelector('.btn')||(body&&body.querySelector('.rx-verdict-band .btn')); if(b){ const y=window.scrollY; b.focus({preventScroll:true}); if(window.scrollY!==y) window.scrollTo(0,y); } // 「次へ」へ焦点。WebKit は吸底の帯の中の要素に焦点を当てると preventScroll でも流れ上の位置へ送ることがある（c2 で 158px）：同じタスク内で戻す＝描かれない
  // R-06 の「正解を可視区へ scrollBy」は廃止：作答瞬間の位移 0 が放行門（予算 v1）。正解と所選は、押した肢を覆うなら操作条を流れに戻す（rxFootClear）・正解が視口外なら札（rxOkChip）で隠れない
}
function rxWhyProps(ix,pids){ // 解説を支える命題（options[].why_props）：小さな見出し＋短い参照（rxPropRef：★・冒頭・↗、押すとそのカードへ）。無ければ何も置かない
  const ps=(pids||[]).map(function(id){ return ix&&ix.props&&ix.props[id]&&ix.props[id].prop; }).filter(Boolean); if(!ps.length) return null;
  return el('div',{class:'rx-why-props'},[ el('div',{class:'rx-why-props-h jp',text:t('rxWhyProps')}) ].concat(ps.map(function(p){ return rxPropRef(p); })));
}
function rxTamperName(code,name){ // 篡改型の名：中文界面は i18n の型码表（快审第三十一批 K-02 签发）、無ければデータの名（ja）
  if(App.lang==='zh'){ const m=(T.zh&&T.zh.rxTamperNames)||{}; if(m[code]) return m[code]; }
  return name||(App.rx&&App.rx.ix&&App.rx.ix.tamper[code])||code;
}
function rxKeepOpts(body,it){ // 押した肢を同じ y に：auto margin（親指の届く下側）が消える分を、全部並べ終えてから補う
  const opts=body.querySelector('.opts'); const y0=it&&it.st&&it.st.optsY; if(!opts || y0==null) return;
  const top=function(){ return Math.round(opts.getBoundingClientRect().top+scrollY); };
  const d=y0-top(); if(d<=0) return;
  opts.style.marginTop=d+'px'; // auto margin を固定値に置き換えると、残っていた auto の分（答えた後も僅かに残る）が消えて d だけでは足りない（S8 V-13：第 5 題で 8px 上がった）→ もう一度測って差を足す
  const d2=y0-top(); if(d2) opts.style.marginTop=(d+d2)+'px';
  it.st.keepTop=parseFloat(opts.style.marginTop)||0; it.st.keepW=innerWidth; // 答えた題を描き直すとき（根拠のカードから戻る等）同じ留白を再現する（CR432c-3：戻った位置が 390px ずれていた）。留白は幅に依るので幅も記す（#17⑤）
}
function rxFootWatch(foot){ // 吸底の判定は哨兵（条の直後の 0 高さ）＋IntersectionObserver：哨兵が視口の下に外れていれば条は吸い付いている。視口の高さ・工具欄（iPhone Safari で innerHeight と見える底が違う）に依らない（CR432d-5）
  if(App._rxFootIO){ App._rxFootIO.disconnect(); App._rxFootIO=null; }
  const s=el('div',{class:'rx-run-s','aria-hidden':'true'}); foot.insertAdjacentElement('afterend',s);
  if(typeof IntersectionObserver==='undefined'){ App._rxFootBelow=null; return; }
  App._rxFootBelow=false;
  App._rxFootIO=new IntersectionObserver(function(es){ const e=es[es.length-1]; App._rxFootBelow=!e.isIntersecting && e.boundingClientRect.top>=0; rxFootStuck(); });
  App._rxFootIO.observe(s);
}
function rxFootStuck(){ // 新課の操作条（.rx-run-f）が画面下に吸い付いているときだけ .stuck（裙は吸い付いているときだけ：S2 10-18）
  // .rx-bl-nav＝期末模試（盲答）の下の三つのボタン（S6 の版式：.stuck で裙）
  const f=document.querySelector('#view .rx-run-f, #view .rx-bl-nav'); if(!f) return; let below=App._rxFootBelow; if(below==null){ const r=f.getBoundingClientRect(); below=r.bottom>=innerHeight-2 && r.top<innerHeight; } // IntersectionObserver が無いときだけ幾何で
  const stuck=getComputedStyle(f).position==='sticky' && f.childElementCount>0 && !!below; f.classList.toggle('stuck',stuck);
}
window.addEventListener('scroll',rxFootStuck,{passive:true}); window.addEventListener('resize',rxFootStuck);
function rxFootClear(body,foot,it){ // (c2) 押した肢が視口の下端に貼り付いていると、答えた瞬間に吸底の操作条がその肢を覆う（S8 persona 740・S1 trial 375×667）：覆うなら操作条を流れに戻す（位移 0 のまま；判定と「次へ」は説明の下、ひと滚りで届く）
  foot.classList.remove('flow'); const opts=body.querySelector('.opts'); if(!opts || getComputedStyle(foot).position!=='sticky') return;
  const fr=foot.getBoundingClientRect(); const hit=((it&&it.st&&it.st.picked)||[]).some(function(oi){ const b=opts.querySelector('.opt[data-oi="'+oi+'"]'); if(!b) return false; const r=b.getBoundingClientRect(); return r.bottom>fr.top+1 && r.top<fr.bottom-1; });
  if(hit) foot.classList.add('flow');
}
function rxVbSync(){ // 帯が視口の外（長い肢で下の方を押した・矮い視口・答えた題に戻った：CR432-8／CR432c-3）：判定・札・「次へ」の一行を固定で出す——顶栏の下、押した肢を覆うなら画面の下端（両方覆う極端は顶栏の下）。所選肢は動かさない。帯が見えれば隠す。role=status は帯だけ
  const S=App._rxVb; const run=document.querySelector('#view .rx-run'); let fx=run&&run.querySelector('.rx-vb-fixed');
  if(fx) fx.style.display=''; // 判定のたびに display を戻してから量る（両端とも覆う分岐で none にしたまま、視口が高くなっても出なかった：CR433-3 第 5 条）
  const body=S&&S.body, band=body&&body.isConnected&&body.querySelector('.rx-verdict-band:not(.rx-vb-empty)');
  if(!run || !band){ if(fx) fx.remove(); return; }
  if(rxBandInView(band)){ if(fx) fx.style.display='none'; return; }
  const it=S.it, next=S.next, opts=body.querySelector('.opts');
  if(!fx){ const v=band.querySelector('.rx-vb-v'); fx=el('div',{class:'rx-verdict-band rx-vb-fixed'},[ el('span',{class:'rx-vb-v '+(v?v.className.replace('rx-vb-v','').trim():''),text:v?v.textContent:''}), el('button',{class:'btn',text:App.rxRun.pos+1<App.rxRun.items.length?t('rxNext'):t('rxFinish'),onclick:next}) ]); run.appendChild(fx); }
  fx.style.display='';
  const tb=document.querySelector('.topbar'), top=tb?tb.getBoundingClientRect().bottom:0; // 顶栏の実測の下端（上側の安全区込み）
  const picked=((it&&it.st&&it.st.picked)||[]).map(function(oi){ return opts&&opts.querySelector('.opt[data-oi="'+oi+'"]'); }).filter(Boolean);
  const hits=function(y0,y1){ return picked.some(function(b){ const r=b.getBoundingClientRect(); return r.bottom>y0+1 && r.top<y1-1; }); };
  fx.classList.remove('bottom'); fx.style.top=top+'px'; const hT=fx.getBoundingClientRect().height||44; fx.classList.add('bottom'); fx.style.top=''; const hB=fx.getBoundingClientRect().height||hT; // 上に置いたとき・下に置いたときの実際の高さ（中身と下側の安全区で変わる：CR432d-3）。位置は顶栏の下端・視口の下端から組む（過場動画で祖先に transform が掛かっている間、fixed の矩形は祖先基準になり信用できない：戻った直後に札が落ちた）
  const rt={top:top,bottom:top+hT}, rb={top:innerHeight-hB,bottom:innerHeight};
  if(hits(rt.top,rt.bottom) && hits(rb.top,rb.bottom)){ fx.style.display='none'; return; } // 上に置いても下に置いても押した肢を覆う（極端に低い視口）：固定行を出さず、流れの帯に任せる（#17③）
  const bottom=hits(rt.top,rt.bottom) && !hits(rb.top,rb.bottom); if(!bottom){ fx.classList.remove('bottom'); fx.style.top=top+'px'; }
  const ok=opts&&opts.querySelector('.opt.ok'); const chip=fx.querySelector('.rx-ok-chip'); // 札：正解の肢が（固定の一行の下も含めて）視口に無いとき
  const okOut=!!ok && (function(){ const r=ok.getBoundingClientRect(); const y0=bottom?top:rt.bottom, y1=bottom?rb.top:innerHeight; return r.top<y0 || r.top+44>y1; })();
  if(okOut && !chip){ const k=[].indexOf.call(opts.querySelectorAll('.opt'),ok); fx.insertBefore(el('span',{class:'rx-ok-chip',text:t('optAns')+'：'+('ABCDEF'[k]||'')}),fx.querySelector('.btn')); } else if(!okOut && chip) chip.remove();
}
let rxVbRaf=0;
window.addEventListener('scroll',function(){ if(!App._rxVb || rxVbRaf) return; rxVbRaf=requestAnimationFrame(function(){ rxVbRaf=0; rxVbSync(); }); },{passive:true}); // 滚って帯が見えたら隠す・隠れたら出す
window.addEventListener('resize',function(){ if(!App._rxVb || rxVbRaf) return; rxVbRaf=requestAnimationFrame(function(){ rxVbRaf=0; rxVbSync(); }); }); // 視口の高さが変わったら（転屏・鍵盤）判定し直す
function rxBandInView(band){ const r=band.getBoundingClientRect(), tb=document.querySelector('.topbar'), top=tb?tb.getBoundingClientRect().bottom:0; return r.bottom>top+8 && r.top<innerHeight-8; } // 判定帯が視口に（一部でも）見えているか
function rxOkChip(body,foot){ // 正解の肢が視口に無いとき（長い選択肢で上か下に外れている）：判定の横に「正解：C」の札を出す。ページは動かさない
  const opts=body.querySelector('.opts'); const ok=opts&&opts.querySelector('.opt.ok'), band=body.querySelector('.rx-verdict-band:not(.rx-vb-empty)'), fv=foot&&foot.querySelector('.rx-verdict'); const v=(band&&rxBandInView(band))?band:(fv||band); if(!ok || !v) return; // 帳簿（A′）：札は見えている方の判定（帯が視口外なら吸底の控え）の、「次へ」の左（CR432-8）
  const r=ok.getBoundingClientRect(), tb=document.querySelector('.topbar'), top=tb?tb.getBoundingClientRect().bottom:0, bar=(foot&&getComputedStyle(foot).position==='sticky')?foot.getBoundingClientRect().height:0;
  if(r.top<top || r.top+44>innerHeight-bar){ const k=[].indexOf.call(opts.querySelectorAll('.opt'),ok); const chip=el('span',{class:'rx-ok-chip',text:t('optAns')+'：'+('ABCDEF'[k]||'')}); const nb=v.querySelector('.btn'); if(nb) v.insertBefore(chip,nb); else v.appendChild(chip); }
}
function rxVerdictBand(it,q){ // 帳簿 阶段 3（A′・Q-055）：題文の直下の帯＝判定｜あなたの選択：A（複数は「、」）｜正解が視口外なら「正解：X」札（rxOkChip が足す）｜「次へ」（rxRunFoot が足す）。読み上げは role=status
  const st=it.st, letters=st.picked.map(function(oi){ return 'ABCDEF'[st.order.indexOf(oi)]||''; }).filter(Boolean).join('、');
  const kids=[ el('span',{class:'rx-vb-v '+(st.dontKnow?'dk':st.ok?'ok':'no'),text:st.dontKnow?t('rxDkVerdict'):st.ok?t('rxRight'):t('rxMissed')}) ];
  if(letters) kids.push(el('span',{class:'rx-vb-p',text:t('optPicked')+'：'+letters}));
  return el('div',{class:'rx-verdict-band',role:'status'},kids);
}
function rxVerdict(ok,dk,truth){ const tf=(typeof truth==='boolean'); const tx=dk?t('rxDkVerdict'):(!tf?(ok?t('rxRight'):t('rxMissed')):t(ok?(truth?'rxTfRightTrue':'rxTfRightFalse'):(truth?'rxTfWrongTrue':'rxTfWrongFalse'))); /* truth は厳密な真偽値のときだけ ○× の一句（CR433-7） */ return el('div',{class:'rx-verdict jp '+(dk?'dk':ok?'ok':'no'),role:'status',text:tx}); } // truth が与えられた ○× 題は判定と真偽を一句に（F5-14・4.3.3 #8） // dk＝「わからない」：記録は誤答のまま、表示は中性（U-90）
/* 選択肢の身分（旧課 runner と同じ標示・同じ鍵）：正解／自分で選んだ誤り／それ以外 */
function rxMarkOpt(btn,isAns,picked){
  if(isAns){ btn.classList.add('ok'); btn.appendChild(el('span',{class:'lbl',text:t('optAns')})); }
  else if(picked){ btn.classList.add('no'); btn.appendChild(el('span',{class:'lbl',text:t('optPicked')})); }
  else { btn.classList.add('dim'); btn.appendChild(el('span',{class:'lbl',text:t('optNotAns')})); }
}
/* 答える前の共通部品：「わからない」と「自信なし」（extra＝同じ行に並べる追加の控件） */
function rxAnswerAids(it,onDontKnow,extra){
  const unsure=el('button',{class:'rx-unsure jp','aria-pressed':String(!!it.st.unsure),text:t('rxUnsure'),onclick:rxW(function(){
    it.st.unsure=!it.st.unsure; unsure.setAttribute('aria-pressed',String(it.st.unsure)); unsure.classList.toggle('on',it.st.unsure); })});
  if(it.st.unsure) unsure.classList.add('on');
  return el('div',{class:'rx-aids'},[ unsure, el('button',{class:'btn ghost sm jp rx-dk',text:t('rxDontKnow'),onclick:rxW(onDontKnow)}) ].concat(extra||[]).concat(App.rxRun?[
    el('button',{class:'btn ghost sm jp rx-quit',text:t('rxQuitRun'),onclick:rxW(rxQuitRun)}) ]:[])); // 「ここでやめる」は新課の練習（App.rxRun）の中だけ：旧課の runner（answerFirst）もこの部品を使うが rxQuitRun は App.rxRun が無いと何もしない（4.3.0 補丁 F-02）。 途中でやめる出口（S8 persona 第二批：固定 20 題に途中の出口が無く、上の「戻る」しか無い）。各題は答えた時点で記録済み（rxRecord）なので確認は出さない
}
function rxQuitRun(){ if(!App.rxRun) return; rxRunEnd(); } // ここまでの分で結果へ（未回答は数えない）
/* キーボード（臨床 runner と同じ流儀）：○=O/1 ×=X/2・選択肢 1〜6・わからない 0/D・自信なし U・訂正 ⌘Enter・次へ Enter/→。
 * 入力欄・変換中・浮層の上では奪わない。焦点の当たったボタンの Enter／Space はブラウザに任せる（二重に進まない）。 */
function rxOnKey(e){
  if(!App.rxRun || !document.querySelector('.rx-run-b')) return;
  if(e.defaultPrevented || e.isComposing || e.keyCode===229) return;
  if(typeof overlayOpen==='function' && overlayOpen()) return;
  const k=e.key, tg=(e.target&&e.target.tagName||'').toLowerCase();
  const q=function(s){ return document.querySelector('.rx-run '+s); }, qa=function(s){ return document.querySelectorAll('.rx-run '+s); };
  const press=function(b){ if(b && !b.disabled){ window.__rxKeyGesture=e.isTrusted; try{ b.click(); }finally{ window.__rxKeyGesture=false; } e.preventDefault(); } }; // 只読の説明はキー操作でも出す（U-25）
  if((e.metaKey||e.ctrlKey) && k==='Enter'){ press(q('.rx-check')); return; }
  if(tg==='textarea'||tg==='input'||tg==='select'||(e.target&&e.target.isContentEditable)) return;
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  if((k==='Enter'||k===' ') && (tg==='button'||tg==='a')) return;
  const R=App.rxRun, it=R.items[R.pos]; if(!it) return;
  if(R.blind && !R.graded){ if(k==='ArrowRight'){ press(q('.rx-bl-next')); return; } if(k==='ArrowLeft'){ press(q('.rx-bl-prev')); return; } } // 期末模試：数字＝選ぶだけ（提出しない）、←→＝前後の題
  if(it.st.done){ if(k==='Enter'||k==='ArrowRight') press(q('.rx-verdict-band .btn')||q('.rx-run-f .btn')); return; }
  const kl=k.toLowerCase(), n=/^[1-9]$/.test(k)?parseInt(k,10):0;
  if(kl==='u'){ press(q('.rx-unsure')); return; }
  if(k==='0'||kl==='d'){ press(q('.rx-dk')); return; }
  if(q('.rx-tf-o')){ if(kl==='o'||k==='1') press(q('.rx-tf-o')); else if(kl==='x'||k==='2') press(q('.rx-tf-x')); return; }
  if(n && q('.rx-segs')){ press(qa('.rx-seg')[n-1]); return; }
  if(n && q('.opts')){ press(qa('.opts .opt')[n-1]); return; }
  if(n && q('.rx-self')){ press(qa('.rx-self button')[n-1]); }
}
document.addEventListener('keydown',rxOnKey);
function rxRunEnd(){ App._rxVb=null;
  registerFrame(rxRunEnd,'rx-run');
  rxClearTimer();
  const R=App.rxRun, ix=App.rx.ix;
  const done=R.items.filter(function(it){ return it.st.done; });
  const ok=done.filter(function(it){ return it.st.ok; }).length;
  const shaky={};
  done.forEach(function(it){ if(!it.st.ok || it.st.unsure) (it.props||[]).forEach(function(p){ shaky[p]=1; }); });
  const kids=[ sectionHead(t(R.titleKey),function(){ App.rxRun=null; goBack(); }),
    R.timedOut?el('p',{class:'rx-hint jp',text:t('rxTimeUp')}):null,
    el('p',{class:'rx-score jp',text:t('rxScore').replace('{n}',ok).replace('{m}',done.length)}) ].filter(Boolean);
  if(R.titleKey!=='rxReviewToday'){ // 次の一歩（U-47）：間違えた題だけ解き直す／全問正解ならもう一轮・回のページへ。今日の復習は従来どおり「次の一轮」だけ
    const wrong=done.filter(function(it){ return !it.st.ok; }), acts=el('div',{class:'rx-res-acts'});
    if(wrong.length) acts.appendChild(el('button',{class:'btn',text:tf('rxRetryWrong',{n:wrong.length}),onclick:function(){ wrong.forEach(rxResetItem); rxRun(R.titleKey,wrong,R.lecId,{remake:R.remake,from:R.from}); }}));
    else if(R.remake) acts.appendChild(el('button',{class:'btn',text:t('again'),onclick:function(){ rxRun(R.titleKey,R.remake(),R.lecId,{remake:R.remake,from:R.from}); }}));
    if(R.lecId || R.from==='home') acts.appendChild(el('button',{class:'btn ghost','data-res-back':R.from||'lec',text:t(R.from==='home'?'rxGoHome':'rxBackToLec'),onclick:function(){ App.rxRun=null; goBack(); }})); // 首页から直接始めた練習（期末模試＝lecId なし も）は goBack で首页に戻るので文言も「ホームへ戻る」（Q-074・CR433-36）
    if(acts.firstChild) kids.push(acts);
  }
  if(R.titleKey==='rxReviewToday'){ // U-89: 一轮（20 件）で今日の分が終わったとは限らない。いまの予定で数え直して、残りがあれば次の一轮へ
    const left=rxQueue().list.length;
    if(left) kids.push(el('div',{class:'rx-left'},[ el('p',{class:'rx-hint jp',text:tf('rxReviewLeft',{n:left})}),
      el('button',{class:'btn rx-review-more',text:t('rxReviewToday'),onclick:rxReviewRun}) ]));
    else kids.push(el('div',{class:'rx-left rx-review-done'},[ el('p',{class:'rx-hint jp',text:t('rxReviewDone')}), // 残りが無い：分数の一行だけで画面が空だった（S8 persona 第二批）→ 終わった一言と次の一歩（ホームへ）
      el('button',{class:'btn rx-go-home',text:t('rxGoHome'),onclick:function(){ App.rxRun=null; goHome(); }}) ]));
  }
  if(R.blind && R.graded){ // 期末模試：一題ずつの結果。押すとその題の判定と解説へ（rxBlindReview）
    kids.push(el('h2',{class:'rx-bh jp',text:t('examOverview')}));
    kids.push(el('div',{class:'rx-bl-res'},R.items.map(function(it,i){ const st=it.st;
      return el('button',{class:'srow rx-bl-row','data-i':String(i),onclick:function(){ R.review=i; rxRunRender(); window.scrollTo(0,0); }},[
        el('span',{class:'rx-bl-n mono',text:String(i+1)}),
        el('span',{class:'rx-vb-v '+(st.ok?'ok':'no'),text:st.ok?t('rxRight'):st.blank?t('examOvTodo'):t('rxMissed')}),
        el('span',{class:'sr-m jp',text:snippet(it.q.stem||'',[],48)}) ]); })));
  }
  const ids=Object.keys(shaky).filter(function(p){ return ix.props[p]; });
  if(ids.length){
    kids.push(el('h2',{class:'rx-bh jp',text:t('rxShaky')}));
    ids.forEach(function(pid){ const p=ix.props[pid].prop, card=RX.firstCardOf(ix,pid);
      kids.push(el('div',{class:'rx-gap'},[ rxPropLine(p,{noTriple:true}),
        card?el('button',{class:'rx-tri-go jp',text:t('rxSeeCard'),onclick:function(){ rxGoCard(card,pid); }}):null ].filter(Boolean))); });
  }
  setView(el('div',{class:'rx-run rbody'},kids));
}

/* 文の中の誤り箇所を強調（wrong が文の部分文字列のとき） */
function rxWrongSpansOf(v){ // 錯処の区間：wrong（出題時に改変した所）＋wrong_alt（対調型のもう一方：直しても正しい文になる所。S3 が逐条標注、Q-031(a)）。RX.wrongSpans（s1/q031）が無い底では wrong だけ
  if(!v) return [];
  if(typeof RX!=='undefined' && typeof RX.wrongSpans==='function') return RX.wrongSpans(v);
  const t=v.text||'', w=v.wrong||'', i=w?t.indexOf(w):-1; return i>=0?[{s:i,e:i+w.length,kind:'wrong'}]:[];
}
function rxMarkNode(kind,pair,text,noLabel){ // noLabel：同じ区間が選んだ片段の境で割れた 2 片目以降（札は区間の先頭だけ：CR433-38b 必修 1） // 一つの印：見た目は実線（wrong）／点線（alt）。読み上げには見えない短い札を先に（WCAG 1.3.1：CR433-38 必修 6・快審第五十一批）：一箇所だけ＝「誤りの箇所、」、二箇所並ぶ（対調型）＝実線「下で直してある方」／点線「下では直していない方」（下の「正しくは」は実線の方を直す）
  const key=pair?(kind==='alt'?'rxMarkAltSr':'rxMarkWrongPairSr'):'rxMarkWrongSr';
  return el('mark',{class:'rx-wrong'+(kind==='alt'?' rx-wrong-alt':'')},(noLabel?[]:[ el('span',{class:'rx-srx',text:t(key)}) ]).concat([ document.createTextNode(text) ]));
}
function rxMarkSpans(text,spans){ // 複数の区間に印：wrong は従来の mark.rx-wrong、alt は mark.rx-wrong.rx-wrong-alt（点線の下線：もう一方）。重なりは wrong 優先（先に並べて後ろを飛ばす）
  const ss=(Array.isArray(spans)?spans:[]).filter(function(x){ return x && x.s>=0 && x.e>x.s && x.e<=text.length; }).sort(function(a,b){ return (a.s-b.s) || ((a.kind==='wrong'?0:1)-(b.kind==='wrong'?0:1)); });
  if(!ss.length) return el('span',{class:'jp',text:text});
  const out=el('span',{class:'jp'}), pair=ss.some(function(x){ return x.kind==='alt'; }); let pos=0;
  ss.forEach(function(x){ if(x.s<pos) return; if(x.s>pos) out.appendChild(document.createTextNode(text.slice(pos,x.s))); out.appendChild(rxMarkNode(x.kind,pair,text.slice(x.s,x.e))); pos=x.e; });
  if(pos<text.length) out.appendChild(document.createTextNode(text.slice(pos)));
  return out;
}
function rxMarkWrong(text,wrong){ // 一箇所だけ（選択式の選択肢の反馈など：f.wrong）
  const i=wrong?text.indexOf(wrong):-1;
  return rxMarkSpans(text, i>=0?[{s:i,e:i+wrong.length,kind:'wrong'}]:[]);
}
function rxMarkWrong2(text,spans,a,b){ // 選んだ片段 [a,b) を淡い枠で、その中の錯処（wrong／alt の区間）を mark で：片段（助詞・句読点で切った選べる単位）と錯処（改変した語）が一致しないことを見せる（S8 persona・Codex 両方が指摘）。判定は従来どおり「重なれば正」。第二引数は区間の配列（文字列は受けない：CR433-38 必修 7）
  const ss=(Array.isArray(spans)?spans:[]).filter(function(x){ return x && x.s>=0 && x.e>x.s && x.e<=text.length; }).sort(function(p,q){ return (p.s-q.s) || ((p.kind==='wrong'?0:1)-(q.kind==='wrong'?0:1)); });
  if(!ss.length || a==null || b==null || a>=b) return rxMarkSpans(text,ss);
  const pts=[0,a,b,text.length].concat(ss.reduce(function(acc,x){ return acc.concat([x.s,x.e]); },[])).filter(function(x,i,arr){ return x>=0 && x<=text.length && arr.indexOf(x)===i; }).sort(function(x,y){ return x-y; });
  const spanAt=function(x,y){ return ss.filter(function(q){ return x>=q.s && y<=q.e; })[0]||null; }, pair=ss.some(function(q){ return q.kind==='alt'; });
  const top=[], pick=el('span',{class:'rx-seg-pick'});
  for(let i=0;i+1<pts.length;i++){ const x=pts[i], y=pts[i+1]; if(y<=x) continue; const piece=text.slice(x,y), sp=spanAt(x,y);
    const n=sp?rxMarkNode(sp.kind,pair,piece,x!==sp.s):document.createTextNode(piece); // 一つの区間が片段の境で割れても読み上げの札は先頭の小片だけ（二度読まれていた：CR433-38b 必修 1）
    if(x>=a && y<=b) pick.appendChild(n); else { if(x>=b && pick.childNodes.length && top.indexOf(pick)<0) top.push(pick); top.push(n); } }
  if(pick.childNodes.length && top.indexOf(pick)<0) top.push(pick);
  return el('span',{class:'jp'},top);
}
function rxEvidence(propId,shown){ // 根拠：命題全文＋カードへの跳转（返回で作答現場へ）。shown＝すでに画面に出ている文（陳述・「正しくは」）：同じ文なら全文は繰り返さない（Codex 評判 2/2：解説が題文を逐字で繰り返す）
  const e=App.rx.ix.props[propId]; if(!e) return null;
  const card=RX.firstCardOf(App.rx.ix,propId);
  const dup=(shown||[]).some(function(x){ return x && String(x).trim()===String(e.prop.text||'').trim(); });
  if(dup && !card) return null;
  return el('div',{class:'rx-ev'},[ el('span',{class:'rx-ev-lb jp',text:t('rxBasis')}), dup?null:el('span',{class:'jp rx-ev-t',text:e.prop.text}),
    card?el('button',{class:'rx-tri-go jp',text:t('rxSeeCard'),onclick:function(){ renderRxLecture(App.rx.ix.cards[card].lec); rxGoCard(card,propId,{anchor:'prop',hold:true}); }}):null ].filter(Boolean)); // 行定位：滚動も焦点もその命題の行へ（CR433-38 必修 2）
}

/* ---------- 命題○× ---------- */
function rxBuildTF(Lc){
  const items=[];
  (Lc.props||[]).forEach(function(p){
    const vs=(p.variants||[]).filter(function(v){ return v.text && v.wrong; });
    if(vs.length && App.rng()<0.5) items.push(rxTFItem(p,vs[Math.floor(App.rng()*vs.length)]));
    else items.push(rxTFItem(p,null));
  });
  return rxShuffle(items).slice(0,RX_CAP.tf);
}
/* 文を句読点と主な助詞の後ろで区切る（誤り箇所を選ばせる単位。区切り方は誤り位置に依存しない） */
function rxSegments(text){ // 正規表現の後読みは旧 Safari で構文エラーになるため使わない
  const PUNCT='、。，,・（）「」『』', PART='はがをにでともへや', out=[]; let cur='';
  for(let i=0;i<text.length;i++){
    const ch=text[i], nx=text[i+1]||''; cur+=ch;
    const kanjiOrKata=/[一-鿿゠-ヿ]/.test(nx);
    if(PUNCT.indexOf(ch)>=0 || (PART.indexOf(ch)>=0 && kanjiOrKata && cur.length>1)){ out.push(cur); cur=''; }
  }
  if(cur) out.push(cur);
  return out.filter(function(x){ return x.trim(); });
}
function rxTFItem(p,v){
  const it={kind:'tf',props:[p.id],truth:!v,st:{}}; // truth＝app が出題時に導いた真偽（変種を出せば誤り）。契約（R05）は課程データから独立に導いた真偽と突き合わせる（CR433-22）
  it.render=function(box,after){
    const text=v?v.text:p.text, st=it.st, truth=!v; // finish（函数声明会提升）里要用 truth，必须先于任何调用声明
    box.appendChild(el('p',{class:'rx-stmt jp',text:text}));
    if(!st.done && !st.pickWhere){
      box.appendChild(el('div',{class:'rx-tf'},[
        el('button',{class:'opt jp rx-tf-o',text:t('rxSayTrue'),onclick:rxW(function(){ finish(true,null); })}),
        el('button',{class:'opt jp rx-tf-x',text:t('rxSayFalse'),onclick:rxW(function(){ if(v && !RX.wrongSpans(v).some(function(x){ return x.kind==='wrong'; })){ try{ console.warn('rx: 誤り箇所（wrong）が誤述文に無い変体。× の時点で判分する', v.id); }catch(e){} finish(false,null); return; } // 卡口（CR433-37c）：選べる誤り箇所が無い変体は段を出さず、× の時点で真偽だけで判分・記録する（学生が押しても反応しない段に閉じ込めない）
          if(v){ st.pickWhere=true; box.innerHTML=''; it.render(box,after); rxGuard(box); } else finish(false,null); })})
      ]));
      box.appendChild(el('p',{class:'rx-tf-hint jp',text:t('rxTfHint')})); // 「×」のあとに誤り箇所を選ぶ一手があることを先に言う（S8 persona：予告が無いと×を避ける）。正しい文でも出す：出る・出ないが文の真偽で決まると答えが漏れる（QR31 で総指揮が指摘）
      box.appendChild(rxAnswerAids(it,function(){ st.dontKnow=true; finish(null,null); }));
      return;
    }
    if(!st.done && st.pickWhere){ // ×と答えた：誤り箇所を選ぶ（まだ記録しない：わからない・自信なし・○×の選び直しもここで）
      box.appendChild(el('p',{class:'rx-hint jp',text:t('rxWhere')}));
      box.appendChild(el('div',{class:'rx-segs'},rxSegments(text).map(function(seg,i){
        return el('button',{class:'rx-seg jp',text:seg,onclick:rxW(function(){ finish(false,i); })}); })));
      box.appendChild(rxAnswerAids(it,function(){ st.dontKnow=true; finish(null,null); },[
        el('button',{class:'btn ghost sm jp rx-repick',text:t('rxRepick'),onclick:rxW(function(){ st.pickWhere=false; box.innerHTML=''; it.render(box,after); rxGuard(box); })}) ]));
      return;
    }
    // 揭示
    box.innerHTML='';
    const segR=(v && st.segIdx!=null)?(function(){ const segs=rxSegments(text); let at=0; for(let i=0;i<st.segIdx && i<segs.length;i++) at+=segs[i].length; return segs[st.segIdx]?[at,at+segs[st.segIdx].length]:null; })():null;
    const spans=rxWrongSpansOf(v); // Q-031(a)：wrong と wrong_alt の両方に印（alt は点線）
    box.appendChild(el('p',{class:'rx-stmt jp'},[ v?(segR?rxMarkWrong2(text,spans,segR[0],segR[1]):rxMarkSpans(text,spans)):el('span',{class:'jp',text:text}) ]));
    box.appendChild(el('p',{class:'rx-truth jp '+(truth?'t':'f'),text:truth?t('rxIsTrue'):t('rxIsFalse')})); // この文の正誤は題文の直下に（操作条には短い判定だけ：收尾第二轮 R-05）
    box.appendChild(rxVerdict(st.ok,st.dontKnow,truth)); // ○×：判定は真偽と合わせて一句（4.3.3 #8）
    if(v && st.hit==='alt') box.appendChild(el('p',{class:'rx-alt-note jp',role:'note',text:t('rxAltHit')})); // もう一方（wrong_alt）を選んで正解：そこを直しても正しい文になる、と一言（Q-031(a)）
    if(v){
      box.appendChild(el('div',{class:'rx-var-c jp'},[ el('span',{class:'rx-var-lb',text:t('rxCorrectIs')}), document.createTextNode(v.correct||'') ]));
      if(v.tamper) box.appendChild(el('div',{class:'rx-tamper jp',text:t('rxTamper')+'：'+rxTamperName(v.tamper,App.rx.ix.tamper[v.tamper])}));
    }
    const ev=rxEvidence(p.id,[text, v&&v.correct]); if(ev) box.appendChild(ev);
    function finish(sayTrue,segIdx){ // sayTrue: true=○, false=×, null=わからない
      if(!canWrite()) return; // 判分の直前にもう一度（CR-01）
      let ok=false, hit=null;
      if(sayTrue===true) ok=truth;
      else if(sayTrue===false){
        if(truth) ok=false;
        else if(segIdx==null) ok=true; // 誤述文に × で、誤り箇所を選ばずに判分（× ボタンの卡口から来る：wrong が誤述文に無い変体。CR433-37c）
        else { const sp=RX.wrongSpans(v); // 出題側 rxBuildTF・rxReviewRun の v.text && v.wrong の絞り込みが第二の防線
               const segs=rxSegments(text); let at=0; for(let i=0;i<segIdx;i++) at+=segs[i].length;
               const s1=at+segs[segIdx].length; // 所選の段が錯処（wrong・対調型のもう一方 wrong_alt）のどれかに重なれば正（Q-031(a)）。wrong が先に並ぶので両方に重なれば wrong
               hit=sp.filter(function(x){ return at<x.e && s1>x.s; })[0]||null;
               ok=!!hit; }
      }
      st.hit=hit?hit.kind:null; st.hitSpan=hit?[hit.s,hit.e]:null; // 表示用（S6：alt なら両方に印）。毎回置き直す：記録に失敗して答え直しても前の値を残さない
      if(!rxRecord({mode:'tf',props:[p.id],ok:ok,unsure:!!st.unsure,tamper:v?v.tamper:null,concepts:p.concepts||[]})){ st.dontKnow=false; rxNotSaved(); return; } // 保存できなければ待答のまま（CR-07）
      st.done=true; st.ok=ok; st.pickWhere=false; st.segIdx=(sayTrue===false && segIdx!=null)?segIdx:null;
      box.innerHTML=''; it.render(box,after); after();
    }
  };
  return it;
}

/* ---------- 選択（本番形・実力判定）・国試形 ---------- */
function rxQItem(q){
  const it={kind:'q',q:q,props:[],st:{order:RX.shuffledOrder(q.options.length,App.rng),picked:[]}};
  q.options.forEach(function(o){ if(o.prop && it.props.indexOf(o.prop)<0) it.props.push(o.prop); });
  it.render=function(box,after){
    const st=it.st, ix=App.rx.ix;
    RX.questionParts(q).forEach(function(part){ // 国試事例題＝事例→設問→選択肢
      if(part==='case') box.appendChild(el('div',{class:'rx-case jp',text:q.case}));
      if(part==='stem'){ box.appendChild(el('p',{class:'rx-stem jp',text:q.stem||''}));
        box.appendChild(st.done?rxVerdictBand(it,q):el('div',{class:'rx-verdict-band rx-vb-empty','aria-hidden':'true'})); } // 帳簿 阶段 3（Q-055 A′）：判定の帯は題文の直下。答える前から同じ高さの空位を置く＝題文・肢は動かない
      if(part==='options'){
        const wrap=el('div',{class:'opts'});
        st.order.forEach(function(oi,k){
          const o=q.options[oi];
          const picked=st.picked.indexOf(oi)>=0;
          const btn=el('button',{class:'opt jp'+(picked?' on':''),'aria-pressed':String(picked),'data-oi':String(oi)},[
            el('span',{class:'mk',text:'ABCDEF'[k]||''}), el('span',{text:o.text}) ]);
          if(st.done){
            btn.disabled=true;
            rxMarkOpt(btn,!!o.correct,picked);
          } else btn.addEventListener('click',rxW(function(){ // 選ぶ数は題の select を超えない（CR-16：保存失敗のあと別の肢を押すと旧い肢と一緒に提出していた）
            const lim=q.select||1;
            if(lim===1) st.picked=[oi]; // 単選：押した肢に置き換えて提出（同じ肢をもう一度＝出し直し）
            else { const i=st.picked.indexOf(oi); if(i>=0) st.picked.splice(i,1); else { st.picked.push(oi); while(st.picked.length>lim) st.picked.shift(); } } // 複選：満ちていれば最も古い選択と入れ替える
            if(st.picked.length>=lim) submit(); else { box.innerHTML=''; it.render(box,after); }
          }));
          wrap.appendChild(btn);
        });
        box.appendChild(wrap);
      }
    });
    if(!st.done){
      if((q.select||1)>1) box.insertBefore(el('p',{class:'rx-hint jp',text:t('rxPickN').replace('{n}',q.select)}),box.lastChild);
      box.appendChild(rxAnswerAids(it,function(){ st.picked=[]; st.dontKnow=true; submit(); }));
      return;
    }
    // 解説（理由・誤りの箇所・正しくは・改変の型・根拠）は押した肢の行の直下へ（A′：別の一覧で肢を繰り返さない）。押した肢より下の肢は解説の分だけ下がる（位移口径：題頭・押した肢とその上は 0）
    const wrap=box.querySelector('.opts'); // 解説を出す肢＝押した肢。間違えたとき・「わからない」のときは正解の肢も（CR432-1：正解の説明・根拠が消えていた）
    const showOi=st.order.filter(function(oi){ return st.picked.indexOf(oi)>=0 || (!!q.options[oi].correct && !st.ok); }), multi=showOi.length>1, dets=[]; let anchor=null;
    st.order.forEach(function(oi,k){
      if(showOi.indexOf(oi)<0) return;
      const f=RX.optionFeedback(ix,q,oi);
      const why=f.correct?((q.options[oi]||{}).why||null):null; // 正肢の理由＝正肢自身の options[].why（方案 4-4。S1 の RX.whyCorrect(q) ができたら差し替え）。無ければ場所も取らない
      const det=el('div',{class:'rx-opt-d '+(f.correct?'ok':'no'),'data-oi':String(oi)},[
        multi?el('span',{class:'rx-opt-dk',text:'ABCDEF'[k]||''}):null, // 複選：どの肢の解説か（下にまとめるので字母を添える）
        (!f.correct && f.wrong)?el('div',{class:'rx-opt-w jp'},[ rxMarkWrong(f.text,f.wrong) ]):null, // 誤りの箇所に印（行の本文は動かさない）
        why?el('div',{class:'rx-why jp',text:why}):null,
        rxWhyProps(ix,(q.options[oi]||{}).why_props), // 根拠になる命題（why_props）の短い参照（CX1-F04・4.3.3 #2）
        f.fix?el('div',{class:'rx-var-c jp'},[ el('span',{class:'rx-var-lb',text:t('rxCorrectIs')}), document.createTextNode(f.fix) ]):null,
        f.tamper?el('div',{class:'rx-tamper jp',text:t('rxTamper')+'：'+rxTamperName(f.tamper.code,f.tamper.name)}):null,
        f.propId?rxEvidence(f.propId,[f.text, f.fix]):null
      ].filter(Boolean));
      const btn=wrap&&wrap.querySelector('.opt[data-oi="'+oi+'"]'); if(!btn || !det.childNodes.length) return;
      if(multi){ dets.push(det); anchor=btn; } else btn.insertAdjacentElement('afterend',det);
    });
    if(multi && anchor){ dets.reverse().forEach(function(d){ anchor.insertAdjacentElement('afterend',d); }); } // 解説が二つ以上（複選・誤答時の正解肢）：いちばん下の肢の下に字母つきでまとめる——上の肢の解説がその下の押した肢を動かさない（位移 0 の口径。RP25：医学 L02 第 4 題で 234px）
    function submit(){
      const o0=box.querySelector('.opts'); st.optsY=o0?Math.round(o0.getBoundingClientRect().top+scrollY):null; // 答える前の選択肢の位置（文書座標）
      if(!canWrite()) return; // 判分の直前にもう一度（CR-01）
      const judged=RX.judge(q,st.picked), evs=rxQEvents(q,st.picked,!!st.unsure,q.type,judged);
      if(evs.length && !rxRecord(evs)){ st.picked=[]; st.dontKnow=false; rxNotSaved(); box.innerHTML=''; it.render(box,after); return; } // 一題の全命題を一つの事務で。保存できなければ待答に戻す：選択も外す（N-D：残った選択に次の選択が足されて誤判定していた）
      st.done=true; st.ok=judged;
      box.innerHTML=''; it.render(box,after); after();
    }
  };
  return it;
}

/* 一題の作答 → 記録の事件（命題ごと）：正肢の命題は判定どおり、選んだ誤肢の命題は誤り。一題で同じ命題は一度だけ（複選の正肢二つが同じ命題に挂かる題で seen が二つ進んでいた）。
 * rxQItem（その場で判定）と期末模試の一括採点（rxBlindGrade）で共用 */
function rxQEvents(q,picked,unsure,mode,judged){
  const ix=App.rx.ix, props=[];
  q.options.forEach(function(o){ if(o.correct && o.prop) props.push({p:o.prop,ok:judged}); });
  picked.forEach(function(oi){ const o=q.options[oi]; if(o && !o.correct && o.prop) props.push({p:o.prop,ok:false}); });
  const one={}; props.forEach(function(x){ if(one[x.p]) one[x.p].ok=one[x.p].ok && x.ok; else one[x.p]=x; });
  return Object.keys(one).map(function(k){ return one[k]; }).map(function(x){ const pe=ix.props[x.p]; const o=q.options.filter(function(y){ return y.prop===x.p; })[0];
    const ve=o&&o.variant&&ix.variants[o.variant];
    return {mode:mode,props:[x.p],ok:x.ok,unsure:unsure,tamper:(!x.ok&&ve)?ve.variant.tamper:null,concepts:pe?pe.prop.concepts||[]:[]}; });
}

/* ---------- 期末の模擬試験：整場盲答（4.3.3 #11・FX1-06。行為規格は S1_4.3.3_計画 #11、総指揮 10-19 定 ②） ----------
 * 答えている間：判定・解説を出さない。選び直せる・前後に移れる・上の題号の並び（回答済み・未回答・自信がない）から跳べる。
 * 「採点する」→ 確認（未回答の数）→ 一度に判定。記録は一つの写入単元（rxSchedRecord に配列で渡す＝quotaAdmitted の一単元、mode＝'mock'）。未回答は不正解（時間切れと同じ）。
 * 時間切れ＝その時点の解答で自動提出。書き手でなくなった（(c)）＝全部捨てて何も記録しない（rxInterrupt）。提出の記録が書けなければ答えている状態に留まる（時間切れなら tuFail）。
 * 進度は保存しない：アプリの中で離れるときは確かめる（rxBlindGuard：見出しの戻る・ブランド・ブラウザの戻る・課の切替・talk の移動）。 */
function rxBlindActive(){ const R=App.rxRun; return !!(R && R.blind && !R.graded && !R.interrupted && !R.tuFail && App.course && App.course.id===R.cid); }
function rxBlindAsk(){ // 離れてよいか（Promise<boolean>）。期末模試の最中でなければすぐ true。やめると決まったら模試を捨てる（計時も止める）
  if(!rxBlindActive()) return Promise.resolve(true);
  const R=App.rxRun;
  return askConfirm(t('rxModeMock'),t('rxMockLeaveQ'),t('rxMockLeaveOk'),true,t('rxMockLeaveNo')).then(function(ok){
    if(ok && !(App.rxRun===R && rxBlindActive())) return false; // 確かめている間に交卷（時間切れ）した・別の模試になった：結果を消さない、ここに留まる（CR433-9 必修 3）
    if(ok){ rxClearTimer(); App.rxRun=null;
      const root=document.getElementById('modalRoot'); if(root) [].slice.call(root.children).forEach(function(m){ if(m.classList.contains('closing')) m.remove(); }); } // 閉じかけの確認框を先に外す：goBack は #modalRoot に子があると「浮層を閉じる」だけで画面を戻さない（PS29：ブラウザの戻る・見出しの戻るで残っていた）
    return ok; });
}
function rxBlindGuard(go){ if(!rxBlindActive()){ go(); return; } rxBlindAsk().then(function(ok){ if(ok) go(); }); } // 模試の最中でなければ同期で（ふつうの練習の戻る・ブランドが一拍遅れない：CR433-9 必修 6）
function rxBlindAnswered(it){ return it.st.picked.length>=((it.q&&it.q.select)||1); } // 複選は選び切ってはじめて回答済み：足りなければ題号条・交卷の確認・判定のどれでも未回答（#27(b)：逐題の練習は選び切るまで提出できない＝原模試と同じ）
function rxBlindPaint(R,it){ // 選んだ印と題号の並びだけ塗り替える（作り直すと押したボタンが消えて画面がずれる：旧課の模試 O-17 と同じ）
  document.querySelectorAll('.rx-blind .opts .opt').forEach(function(b){ const on=it.st.picked.indexOf(+b.getAttribute('data-oi'))>=0; b.classList.toggle('on',on); b.setAttribute('aria-pressed',String(on)); });
  const chips=document.querySelectorAll('.rx-blind .examstrip .echip');
  R.items.forEach(function(x,i){ const c=chips[i]; if(!c) return; c.className='echip'+(i===R.pos?' cur':'')+(rxBlindAnswered(x)?' done':'')+(x.st.unsure?' is-unc':''); if(i===R.pos) c.setAttribute('aria-current','true'); else c.removeAttribute('aria-current');
    c.setAttribute('aria-label',tf('rxBlChipAria',{n:i+1,state:t(rxBlindAnswered(x)?'examOvDone':'examOvTodo')+(x.st.unsure?t('rxBlChipSep')+t('examUncertain'):'')})); }); // aria-current：今の題。aria-label：題号と状態（「第3問：回答済み・自信がない」：#27(a)・快审第四十五批）
}
function rxBlindGo(R,i){ if(R.graded || App.rxRun!==R || i<0 || i>=R.items.length || i===R.pos) return; R.pos=i; rxStep=true; rxRunRender(); window.scrollTo(0,0); } // 交卷後は動かない（開いたままの確認框の題号から作答に戻らない：CR433-9 必修 3）
function rxBlindRender(R,step){
  const it=R.items[R.pos], q=it.q, st=it.st;
  const body=el('div',{class:'rx-run-b',tabindex:'-1'});
  RX.questionParts(q).forEach(function(part){
    if(part==='case') body.appendChild(el('div',{class:'rx-case jp',text:q.case}));
    if(part==='stem') body.appendChild(el('p',{class:'rx-stem jp',text:q.stem||''}));
    if(part==='options'){
      const wrap=el('div',{class:'opts'});
      st.order.forEach(function(oi,k){
        const on=st.picked.indexOf(oi)>=0;
        const btn=el('button',{class:'opt jp'+(on?' on':''),'aria-pressed':String(on),'data-oi':String(oi)},[ el('span',{class:'mk',text:'ABCDEF'[k]||''}), el('span',{text:q.options[oi].text}) ]);
        btn.addEventListener('click',rxW(function(){
          const lim=q.select||1;
          if(lim===1) st.picked=(st.picked[0]===oi)?[]:[oi]; // 単選：押した肢に置き換え。同じ肢をもう一度＝取り消し（未回答に戻せる）
          else { const i=st.picked.indexOf(oi); if(i>=0) st.picked.splice(i,1); else { st.picked.push(oi); while(st.picked.length>lim) st.picked.shift(); } } // 複選：満ちていれば最も古い選択と入れ替える
          rxBlindPaint(R,it);
        }));
        wrap.appendChild(btn);
      });
      body.appendChild(wrap);
    }
  });
  if((q.select||1)>1) body.insertBefore(el('p',{class:'rx-hint jp',text:t('rxPickN').replace('{n}',q.select)}),body.lastChild);
  const unsure=el('button',{class:'rx-unsure jp'+(st.unsure?' on':''),'aria-pressed':String(!!st.unsure),text:t('rxUnsure'),onclick:rxW(function(){
    st.unsure=!st.unsure; unsure.classList.toggle('on',st.unsure); unsure.setAttribute('aria-pressed',String(st.unsure)); rxBlindPaint(R,it); })});
  body.appendChild(el('div',{class:'rx-aids'},[unsure]));
  let timer=null;
  if(R.deadline){
    timer=el('span',{class:'rx-timer mono','aria-live':'off',text:rxTimeLeftText(R)});
    rxClearTimer();
    App.rxTimer=setInterval(function(){ if(App.rxRun!==R || !App.course || App.course.id!==R.cid){ rxClearTimer(); return; }
      if(Date.now()>=R.deadline){ rxTimeUp(); return; } timer.textContent=rxTimeLeftText(R); },500);
  }
  const strip=el('div',{class:'examstrip'},R.items.map(function(x,i){ return el('button',{class:'echip',type:'button',text:String(i+1),onclick:function(){ rxBlindGo(R,i); }}); }));
  const last=R.pos>=R.items.length-1;
  const prev=el('button',{class:'btn ghost rx-bl-prev',text:t('prev'),onclick:function(){ rxBlindGo(R,R.pos-1); }}); if(R.pos<=0) prev.disabled=true;
  const next=el('button',{class:'btn rx-bl-next'+(last?' ghost':''),text:t('next'),onclick:function(){ rxBlindGo(R,R.pos+1); }}); if(last) next.disabled=true;
  const submit=el('button',{class:'btn rx-bl-submit'+(last?'':' ghost'),text:t('examSubmit'),onclick:function(){ rxBlindCheck(R); }}); // 最後の題でだけ「採点する」が主ボタン（旧課の模試と同じ）
  App._rxVb=null;
  const nav=el('div',{class:'examnav rx-bl-nav'},[prev,next,submit]);
  setView(el('div',{class:'rx-run rx-q rx-blind rbody'+(step?' qstep-next':'')},[
    sectionHead(t(R.titleKey),function(){ rxBlindGuard(goBack); }),
    el('div',{class:'qnum'},[ timer, el('span',{class:'prog',text:(R.pos+1)+' / '+R.items.length}) ].filter(Boolean)),
    strip, body, nav ]));
  rxBlindPaint(R,it);
  const cur=strip.querySelector('.echip.cur'); if(cur){ try{ cur.scrollIntoView({inline:'center',block:'nearest'}); }catch(e){} } // 題を移ったら今の題号を条の中へ（S6 版式：scroll-snap は利用者の滚动にしか効かない）
  rxFootWatch(nav); rxFootStuck(); // 下の三つのボタンの吸底（.stuck）判定：練習の操作条と同じ哨兵＋IntersectionObserver
}
function rxBlindCheck(R){ // 提出前の確認（旧課の模試と同じ部品・文言）：未回答と「自信がない」の題号（押すとその題へ）
  if(R.graded || App.rxRun!==R) return;
  const unans=[], unc=[];
  R.items.forEach(function(it,i){ if(!rxBlindAnswered(it)) unans.push(i+1); if(it.st.unsure) unc.push(i+1); });
  const body=[];
  if(!unans.length && !unc.length) body.push(el('p',{class:'jp',text:t('examAllDone')}));
  const mk=function(label,arr,warn){ if(!arr.length) return; body.push(el('div',{class:'chkline'+(warn?' warn':'')},[ el('div',{class:'cl-l jp',text:label}),
    el('div',{class:'cl-n'},arr.map(function(n){ return el('button',{class:'sc-q mono',type:'button',text:String(n),onclick:function(){ closeModal(); rxBlindGo(R,n-1); }}); })) ])); };
  mk(t('examOvTodo'),unans,true); mk(t('examUncList'),unc,false);
  if(unans.length) body.push(el('p',{class:'jp warn',style:'margin-top:10px',text:t('examWillWrong')}));
  body.push(el('div',{class:'row',style:'margin-top:14px;gap:10px'},[
    el('button',{class:'btn rx-bl-do',text:t('examDoSubmit'),onclick:function(){ closeModal(); rxBlindGrade(R,false); }}),
    el('button',{class:'btn ghost',text:t('back'),onclick:closeModal}) ]));
  openModal(modalShell(t('examSubmitTitle'),body));
}
function rxBlindCloseAsk(){ // 開いていた確認框（提出前・離れる）を閉じる：時間切れで判定した・書けずに「もう一度保存する」へ移った後に、古い確認で模試を動かさせない（CR433-9 必修 3・CR433-16）。更新後の確認門は closeModal が閉じない
  try{ const mr=document.getElementById('modalRoot'); if(mr && mr.querySelector(':scope > .modal:not(.closing)')) closeModal(); }catch(e){}
}
function rxBlindGrade(R,auto){ // 一度に判定し、一つの写入単元で記録する。auto＝時間切れ
  if(App.rxRun!==R || R.graded || R.interrupted) return;
  if(!App.course || App.course.id!==R.cid){ rxClearTimer(); return; } // 別の課へ移った（CR-23）
  if(auto){ if(!fenceOk()){ rxClearTimer(); R.tuFail=true; rxBlindCloseAsk(); rxRunRender(); return; } } // 書けない：計時を止め「もう一度保存する」へ（自動では試し直さない：WLR1 合并裁定 三-9）
  else if(!canWrite()) return;
  const evs=[], res=R.items.map(function(it){ const q=it.q, st=it.st;
    if(!rxBlindAnswered(it)){ (it.props||[]).forEach(function(pid){ evs.push({mode:'mock',props:[pid],ok:false,unsure:false}); }); return false; } // 未回答＝時間切れと同じ扱い（mode 'mock'）
    const judged=RX.judge(q,st.picked); rxQEvents(q,st.picked,!!st.unsure,q.type,judged).forEach(function(e){ evs.push(e); }); return judged; }); // 答えた題の mode は題型（原模試と同じ：CR433-9 必修 5）
  if(evs.length && !rxRecord(evs)){ // 何も残っていない（rxSchedRecord が戻した）：答えている状態に留まる
    if(auto){ rxClearTimer(); rxBlindCloseAsk(); if(typeof rxDataNewer==='function' && rxDataNewer()){ R.newer=true; rxRunRender(); return; } R.tuFail=true; pulseWriterBanner(); rxRunRender(); } else rxNotSaved(); // 先の版の記録：押し直しは出さない（CR433-10）
    return;
  }
  rxClearTimer();
  R.items.forEach(function(it,i){ const st=it.st; st.done=true; st.ok=res[i]; if(!rxBlindAnswered(it)){ st.blank=true; if(auto) st.timeout=true; } });
  R.graded=true; R.timedOut=!!auto; R.tuFail=false; R.review=null; R.pos=R.items.length;
  rxBlindCloseAsk(); // 交卷後にこの模試を変えさせない（CR433-9 必修 3）
  rxRunRender();
}
function rxBlindReview(R){ // 採点後の見直し：一題ずつ、答えた後の描き方（帳簿 A′：判定の帯・押した肢の下の解説・根拠）で
  const i=R.review, it=R.items[i]; App._rxVb=null;
  const body=el('div',{class:'rx-run-b',tabindex:'-1'});
  it.render(body,function(){});
  const go=function(j){ if(j<0 || j>=R.items.length) return; R.review=j; rxRunRender(); window.scrollTo(0,0); };
  const prev=el('button',{class:'btn ghost rx-bl-prev',text:t('prev'),onclick:function(){ go(i-1); }}); if(i<=0) prev.disabled=true;
  const next=el('button',{class:'btn rx-bl-next',text:t('next'),onclick:function(){ go(i+1); }}); if(i>=R.items.length-1) next.disabled=true;
  setView(el('div',{class:'rx-run rx-q rx-answered rx-blind-rv rbody'},[
    sectionHead(t(R.titleKey),function(){ R.review=null; rxRunRender(); }),
    el('div',{class:'qnum'},[ el('span',{class:'prog',text:(i+1)+' / '+R.items.length}) ]),
    body, el('div',{class:'examnav'},[prev,next]) ]));
}

/* ---------- 訂正ドリル ---------- */
function rxFixItem(p,v){
  const it={kind:'fix',props:[p.id],st:{text:''}};
  it.render=function(box,after){
    const st=it.st;
    box.appendChild(el('div',{class:'rx-fix-l jp',text:t('rxWrongStmt')}));
    const ta=el('textarea',{class:'answer jp',placeholder:t('rxWriteFix')}); ta.value=st.text||'';
    ta.addEventListener('input',function(){ st.text=ta.value; });
    if(!st.revealed){
      box.appendChild(el('p',{class:'rx-stmt jp',text:v.text}));
      box.appendChild(ta);
      if(!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches)) requestAnimationFrame(function(){ if(ta.isConnected && !st.revealed) try{ ta.focus({preventScroll:true}); }catch(_){} }); // すぐ書き始められるように（U-60）。触屏はキーボードが文を隠すので出さない
      box.appendChild(el('button',{class:'btn rx-check',text:t('rxCheck'),onclick:rxW(function(){ st.revealed=true; box.innerHTML=''; it.render(box,after); rxGuard(box);
        const g=box.querySelector('.rx-self button'); if(g) try{ g.focus({preventScroll:true}); }catch(_){} })})); // 揭示後は自評の組へ焦点（textarea が消えて BODY に落ちていた：复查 U-12）
      box.appendChild(rxAnswerAids(it,function(){ st.revealed=true; st.dontKnow=true; box.innerHTML=''; it.render(box,after); }));
      return;
    }
    box.appendChild(el('p',{class:'rx-stmt jp'},[ rxMarkSpans(v.text,rxWrongSpansOf(v)) ])); // 誤った文は一度だけ（誤りの箇所に印、対調型は両方：Q-031(a)。U-60：上下に二度出ていた）
    const cmp=el('div',{class:'rx-fix-cmp'}); // 自分の答え｜正しくは を並べて見比べる（宽い画面は左右、狭い画面は上下）
    if(st.text) cmp.appendChild(el('div',{class:'rx-mine jp'},[ el('span',{class:'rx-var-lb',text:t('yourAns')}), document.createTextNode(st.text) ]));
    cmp.appendChild(el('div',{class:'rx-var-c jp'},[ el('span',{class:'rx-var-lb',text:t('rxCorrectIs')}), document.createTextNode(v.correct||'') ]));
    box.appendChild(cmp);
    if(v.tamper) box.appendChild(el('div',{class:'rx-tamper jp',text:t('rxTamper')+'：'+rxTamperName(v.tamper,App.rx.ix.tamper[v.tamper])}));
    const ev=rxEvidence(p.id,[v.text, v.correct, st.text]); if(ev) box.appendChild(ev);
    if(st.done){ box.appendChild(st.dontKnow?rxVerdict(false,true):el('div',{class:'rx-verdict jp '+(st.ok?'ok':'no'),role:'status',text:t(st.self==='good'?'rxSelfGood':st.self==='part'?'rxSelfPart':'rxSelfBad')})); return; }
    if(st.dontKnow){ rate('bad'); return; }
    box.appendChild(el('div',{class:'rx-self'},['good','part','bad'].map(function(k){
      return el('button',{class:'btn ghost sm jp',text:t(k==='good'?'rxSelfGood':k==='part'?'rxSelfPart':'rxSelfBad'),onclick:rxW(function(){ rate(k); })}); })));
    function rate(k){
      if(!canWrite()) return; // 記録の直前にもう一度（CR-01）
      const okk=(k!=='bad'), uns=!!st.unsure||k==='part';
      if(!rxRecord({mode:'fix',props:[p.id],ok:okk,unsure:uns,tamper:okk?null:v.tamper,concepts:p.concepts||[]})){ // 保存できなければ自評前のまま（CR-07）
        if(st.dontKnow){ st.dontKnow=false; st.revealed=false; box.innerHTML=''; it.render(box,after); } rxNotSaved(); return; }
      st.self=k; st.done=true; st.ok=okk; if(k==='part') st.unsure=true;
      box.innerHTML=''; it.render(box,after); after();
    }
  };
  return it;
}

/* ---------- 選択肢つき小問（症状→疾患・人物年代グリッド）共通 ---------- */
function rxPickItem(spec){ // spec: {prompt, lines[], options[], answer, props[], record}
  const it={kind:spec.kind,props:spec.props,st:{order:RX.shuffledOrder(spec.options.length,App.rng)}};
  it.render=function(box,after){
    const st=it.st;
    box.appendChild(el('p',{class:'rx-stem jp',text:spec.prompt}));
    if(spec.lines && spec.lines.length) box.appendChild(el('ul',{class:'rx-lines jp'},spec.lines.map(function(x){ return el('li',{text:x}); })));
    const wrap=el('div',{class:'opts'});
    st.order.forEach(function(oi){
      const btn=el('button',{class:'opt jp'+(st.done&&oi===st.picked?' on':'')},[ el('span',{text:spec.options[oi]}) ]);
      if(st.done){ btn.disabled=true; rxMarkOpt(btn,oi===spec.answer,oi===st.picked); }
      else btn.addEventListener('click',rxW(function(){ st.picked=oi; done(); }));
      wrap.appendChild(btn);
    });
    box.appendChild(wrap);
    if(!st.done){ box.appendChild(rxAnswerAids(it,function(){ st.picked=-1; st.dontKnow=true; done(); })); return; }
    box.appendChild(rxVerdict(st.ok,st.dontKnow));
    spec.props.forEach(function(pid){ const ev=rxEvidence(pid); if(ev) box.appendChild(ev); });
    function done(){
      if(!canWrite()) return; // 判分の直前にもう一度（CR-01）
      const okk=(st.picked===spec.answer);
      const evs=spec.props.map(function(pid){ const pe=App.rx.ix.props[pid];
        return {mode:spec.kind,props:[pid],ok:okk,unsure:!!st.unsure,tamper:null,concepts:pe?pe.prop.concepts||[]:[]}; });
      if(evs.length && !rxRecord(evs)){ st.picked=undefined; st.dontKnow=false; rxNotSaved(); box.innerHTML=''; it.render(box,after); return; } // 一題の全命題を一つの事務で。保存できなければ待答のまま（CR-07・CR-10）
      st.done=true; st.ok=okk;
      box.innerHTML=''; it.render(box,after); after();
    }
  };
  return it;
}
function rxSympProps(c){ // 典型症状の欄に挂かる命題（その欄に命題が無ければカード全体の先頭から）
  const f=(c.fields||[]).filter(function(x){ return /症状/.test(x.label||''); })[0];
  const ps=((f&&f.props)||[]).filter(function(pid){ return App.rx.ix.props[pid]; });
  return (ps.length?ps:RX.cardProps(c).filter(function(pid){ return App.rx.ix.props[pid]; })).slice(0,3);
}
function rxBuildSym(cards){
  const pool=rxCourseCards('body').filter(function(c){ return (c.symptoms||[]).length; });
  const items=[];
  cards.forEach(function(c){
    const others=rxShuffle(pool.filter(function(x){ return x.id!==c.id; })).slice(0,3);
    const opts=[c].concat(others);
    // 逆向き（病名→症状）は各選択肢の条目数をそろえる：n＝min(3, 本題 4 枚の最少条目数)。条目の少ないカードの正答だけ短いと、中身を見なくても選べる。
    // 対象が 1 条しかないカードは順向きだけ（symptoms 修正の签发 97f9065）
    const n=Math.min(3,Math.min.apply(null,opts.map(function(x){ return x.symptoms.length; })));
    if(c.symptoms.length<2 || App.rng()<0.5) items.push(rxPickItem({kind:'sym',prompt:t('rxSymFwd'),lines:c.symptoms,options:opts.map(function(x){ return x.title; }),answer:0,props:rxSympProps(c)}));
    else items.push(rxPickItem({kind:'sym',prompt:t('rxSymRev').replace('{d}',c.title),lines:[],options:opts.map(function(x){ return x.symptoms.slice(0,n).join('・'); }),answer:0,props:rxSympProps(c)}));
  });
  return rxShuffle(items);
}
function rxBuildGrid(cards){
  const items=[];
  cards.forEach(function(c){
    c.rows.forEach(function(r,ri){
      const cells=r.cells||[], col=1+Math.floor(App.rng()*Math.max(1,cells.length-1));
      const others=c.rows.filter(function(x,j){ return j!==ri && x.cells && x.cells[col]; }).map(function(x){ return x.cells[col]; });
      const uniq=others.filter(function(x,i){ return others.indexOf(x)===i && x!==cells[col]; });
      const opts=[cells[col]].concat(rxShuffle(uniq).slice(0,3));
      const shown=cells.map(function(x,i){ return (c.cols[i]||'')+'：'+(i===col?'＿＿':x); });
      items.push(rxPickItem({kind:'grid',prompt:t('rxGridQ').replace('{c}',c.cols[col]||''),lines:shown,options:opts,answer:0,props:(r.props||[]).slice(0,3)}));
    });
  });
  return rxShuffle(items).slice(0,RX_CAP.grid);
}
