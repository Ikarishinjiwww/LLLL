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
      return el('button',{class:'rx-mode jp','data-mode':m.key,onclick:function(){ rxRun(m.lk,m.build(),Lc.id,{remake:m.build}); }},[
        el('span',{text:m.label}), el('span',{class:'rx-mode-n',text:rxModeCountText(m)}) ]);
    })) ]);
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
  App.rxRun={titleKey:titleKey,items:items,pos:0,lecId:lecId,cid:App.course.id,remake:(opt&&opt.remake)||null, // cid＝この練習の課（限時の再試行・記録が別の課に流れないよう照合：CR-23） // remake＝同じ練法でもう一轮（結果の「もう一度」）
    deadline:(opt&&opt.secPerItem)?Date.now()+items.length*opt.secPerItem*1000:null};
  rxRunRender();
}
function rxResetItem(it){ const o=it.st||{}; it.st=o.order?{order:RX.shuffledOrder(o.order.length,App.rng)}:{}; if(it.kind==='q') it.st.picked=[]; if(it.kind==='fix') it.st.text=''; return it; } // 解き直し用：作答の状態だけ白紙に（選択肢は並べ直す）
function rxClearTimer(){ if(App.rxTimer){ clearInterval(App.rxTimer); App.rxTimer=null; } }
function rxTimeLeftText(R){ const s=Math.max(0,Math.round((R.deadline-Date.now())/1000)); return t('rxTimeLeft').replace('{m}',Math.floor(s/60)).replace('{s}',String(s%60).padStart(2,'0')); }
function rxTimeUp(){ // 時間切れ：未回答は不正解として記録し、結果へ。記録が全部保存できてから時間切れを確定する（CR-12）
  const R=App.rxRun; if(!R) return;
  if(!App.course || App.course.id!==R.cid){ rxClearTimer(); return; } // 別の課へ移った練習は打ち切る（CR-23）
  if(!fenceOk()){ rxClearTimer(); R.tuFail=true; rxRunRender(); return; } // 書けない（只読）：計時を止め「もう一度保存する」へ。書き手に戻っても自動では記録しない（書き手が替わった後の遅れた書き込みを作らない：wl-min 30efd59・WLR-B 必修 1）
  const evs=[]; R.items.forEach(function(it){ if(!it.st.done) (it.props||[]).forEach(function(pid){ evs.push({mode:'mock',props:[pid],ok:false,unsure:false}); }); });
  if(evs.length && !rxRecord(evs)){ rxClearTimer(); R.tuFail=true; pulseWriterBanner(); rxRunRender(); return; } // 保存できなければ未回答のまま計時を止め、「もう一度記録する」を出す（合成稿 v3.3：自動では試し直さない。事務は戻してあるので押し直しても二重に数えない）
  rxClearTimer(); R.tuFail=false;
  R.items.forEach(function(it){ if(!it.st.done){ it.st.done=true; it.st.ok=false; it.st.timeout=true; } });
  R.pos=R.items.length; R.timedOut=true; rxRunRender();
}
let rxStep=false; // 「次へ」から来た一回だけ、旧課 runner と同じ換題の歩み（.rbody.qstep-next）を付ける（前端計画 002）
function rxRunRender(){
  const step=rxStep; rxStep=false;
  const R=App.rxRun; if(!R){ goHome(); return; }
  registerFrame(rxRunRender,'rx-run');
  if(R.pos>=R.items.length) return rxRunEnd();
  if(R.tuFail){ // 時間切れの記録が保存できなかった：作答はもう受け付けず、押し直しだけを出す
    rxClearTimer();
    setView(el('div',{class:'rx-run rbody'},[ sectionHead(t(R.titleKey),function(){ App.rxRun=null; goBack(); }),
      el('p',{class:'rx-hint jp',role:'status',text:t('rxTimeUpFail')}),
      el('button',{class:'btn',text:t('rxTimeUpRetry'),onclick:function(){ if(!canWrite()) return; rxTimeUp(); }}) ])); // 書けないときは canWrite の知らせ（只読の説明）を出して何もしない（30efd59）
    return;
  }
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
  const run=el('div',{class:'rx-run rx-q rbody'+(it.st.done?'':' rx-ask')+(step?' qstep-next':'')}); // reduce は styles.css:346 の全停止で止まる
  if(it.kind==='q') foot.classList.add('c2'); // (c2)：答える前から吸底の帯の高さを予約（空のまま見える帯）。Q-051 で確定（(c) 流し込みは撤去）
  it.render(body,function(){ rxRunFoot(foot,it,next,body); if(it.kind==='q'){ run.classList.add('rx-answered'); rxKeepOpts(body,it); rxFootClear(body,foot,it); rxOkChip(body,foot); } else run.classList.remove('rx-ask'); rxRevealed(body,foot); }); // 選択式・国試：答える前の配置を保ったまま（rx-ask を外さない）——ページも押した肢も動かない（S8 V-08、総指揮 (c)／(c2)）
  if(it.st.done) rxRunFoot(foot,it,next,body);
  [ sectionHead(t(R.titleKey),function(){ rxClearTimer(); App.rxRun=null; goBack(); }),
    el('div',{class:'qnum'},[ timer, el('span',{class:'prog',text:(R.pos+1)+' / '+R.items.length}) ].filter(Boolean)),
    body, foot ].forEach(function(n){ run.appendChild(n); });
  setView(run);
}
function rxRunFoot(foot,it,next,body){ // 操作条：左＝判定（role=status ごと題内から移す）・右＝次へ（利き手で鏡像）。文書の流れの中で sticky：短ければ選択肢のすぐ下、長ければ画面下に吸い付く（收尾清单 二）
  foot.innerHTML='';
  const v=body&&body.querySelector('.rx-verdict'); if(v) foot.appendChild(v);
  foot.appendChild(el('button',{class:'btn',text:App.rxRun.pos+1<App.rxRun.items.length?t('rxNext'):t('rxFinish'),onclick:next}));
}
/* 揭示直後：連打で新しい控件を押さないよう 300ms だけ受け付けない／判定行を見える位置へ／焦点は「次へ」へ */
function rxGuard(n){ if(!n) return; n.classList.add('rx-guard'); setTimeout(function(){ n.classList.remove('rx-guard'); },300); }
function rxRevealed(body,foot){
  rxGuard(body); rxGuard(foot);
  const b=foot.querySelector('.btn'); if(b){ const y=window.scrollY; b.focus({preventScroll:true}); if(window.scrollY!==y) window.scrollTo(0,y); } // 「次へ」へ焦点。WebKit は吸底の帯の中の要素に焦点を当てると preventScroll でも流れ上の位置へ送ることがある（c2 で 158px）：同じタスク内で戻す＝描かれない
  // R-06 の「正解を可視区へ scrollBy」は廃止：作答瞬間の位移 0 が放行門（予算 v1）。正解と所選は、押した肢を覆うなら操作条を流れに戻す（rxFootClear）・正解が視口外なら札（rxOkChip）で隠れない
}
function rxTamperName(code,name){ // 篡改型の名：中文界面は i18n の型码表（快审第三十一批 K-02 签发）、無ければデータの名（ja）
  if(App.lang==='zh'){ const m=(T.zh&&T.zh.rxTamperNames)||{}; if(m[code]) return m[code]; }
  return name||(App.rx&&App.rx.ix&&App.rx.ix.tamper[code])||code;
}
function rxKeepOpts(body,it){ // 押した肢を同じ y に：auto margin（親指の届く下側）が消える分を、全部並べ終えてから補う
  const opts=body.querySelector('.opts'); const y0=it&&it.st&&it.st.optsY; if(!opts || y0==null) return;
  const d=y0-Math.round(opts.getBoundingClientRect().top+scrollY); if(d>0) opts.style.marginTop=d+'px';
}
function rxFootClear(body,foot,it){ // (c2) 押した肢が視口の下端に貼り付いていると、答えた瞬間に吸底の操作条がその肢を覆う（S8 persona 740・S1 trial 375×667）：覆うなら操作条を流れに戻す（位移 0 のまま；判定と「次へ」は説明の下、ひと滚りで届く）
  foot.classList.remove('flow'); const opts=body.querySelector('.opts'); if(!opts || !foot.classList.contains('c2') || getComputedStyle(foot).position!=='sticky') return;
  const fr=foot.getBoundingClientRect(); const hit=((it&&it.st&&it.st.picked)||[]).some(function(oi){ const b=opts.querySelector('.opt[data-oi="'+oi+'"]'); if(!b) return false; const r=b.getBoundingClientRect(); return r.bottom>fr.top+1 && r.top<fr.bottom-1; });
  if(hit) foot.classList.add('flow');
}
function rxOkChip(body,foot){ // 正解の肢が視口に無いとき（長い選択肢で上か下に外れている）：判定の横に「正解：C」の札を出す。ページは動かさない
  const opts=body.querySelector('.opts'); const ok=opts&&opts.querySelector('.opt.ok'), v=foot&&foot.querySelector('.rx-verdict'); if(!ok || !v) return;
  const r=ok.getBoundingClientRect(), tb=document.querySelector('.topbar'), top=tb?tb.getBoundingClientRect().bottom:0, bar=(foot.classList.contains('c2')&&!foot.classList.contains('flow'))?foot.getBoundingClientRect().height:0;
  if(r.top<top || r.top+44>innerHeight-bar){ const k=[].indexOf.call(opts.querySelectorAll('.opt'),ok); v.appendChild(el('span',{class:'rx-ok-chip',text:t('optAns')+'：'+('ABCDEF'[k]||'')})); }
}
function showAnswerOpt(opt,bar,picked){ // 正解（＋自分の選択）を可視区へ：両方の合併範囲で必要な分だけ動かす。入らなければ正解だけ。下側は操作条の高さを除く（收尾第二轮 R-06）
  if(!opt) return;
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ // 一帧多く待つ（真 Safari はツールバーの出入りで視口が変わる）
    const tb=document.querySelector('.topbar'), top=(tb?tb.getBoundingClientRect().bottom:52)+8, bh=(bar&&bar.offsetHeight)||0, bottom=innerHeight-bh-8;
    const ro=opt.getBoundingClientRect(), rp=(picked&&picked!==opt)?picked.getBoundingClientRect():null;
    let a=ro.top, b=ro.bottom; if(rp){ a=Math.min(a,rp.top); b=Math.max(b,rp.bottom); }
    if(b-a>bottom-top){ a=ro.top; b=ro.bottom; } // 二つは一屏に入らない：正解を優先
    if(a>=top && b<=bottom) return; // もう見えている
    window.scrollBy(0, a<top ? a-top : b-bottom);
  }); });
}
function rxVerdict(ok,dk){ return el('div',{class:'rx-verdict jp '+(dk?'dk':ok?'ok':'no'),role:'status',text:dk?t('rxDkVerdict'):ok?t('rxRight'):t('rxMissed')}); } // dk＝「わからない」：記録は誤答のまま、表示は中性（U-90）
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
  if(it.st.done){ if(k==='Enter'||k==='ArrowRight') press(q('.rx-run-f .btn')); return; }
  const kl=k.toLowerCase(), n=/^[1-9]$/.test(k)?parseInt(k,10):0;
  if(kl==='u'){ press(q('.rx-unsure')); return; }
  if(k==='0'||kl==='d'){ press(q('.rx-dk')); return; }
  if(q('.rx-tf-o')){ if(kl==='o'||k==='1') press(q('.rx-tf-o')); else if(kl==='x'||k==='2') press(q('.rx-tf-x')); return; }
  if(n && q('.rx-segs')){ press(qa('.rx-seg')[n-1]); return; }
  if(n && q('.opts')){ press(qa('.opts .opt')[n-1]); return; }
  if(n && q('.rx-self')){ press(qa('.rx-self button')[n-1]); }
}
document.addEventListener('keydown',rxOnKey);
function rxRunEnd(){
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
    if(wrong.length) acts.appendChild(el('button',{class:'btn',text:tf('rxRetryWrong',{n:wrong.length}),onclick:function(){ wrong.forEach(rxResetItem); rxRun(R.titleKey,wrong,R.lecId,{remake:R.remake}); }}));
    else if(R.remake) acts.appendChild(el('button',{class:'btn',text:t('again'),onclick:function(){ rxRun(R.titleKey,R.remake(),R.lecId,{remake:R.remake}); }}));
    if(R.lecId) acts.appendChild(el('button',{class:'btn ghost',text:t('rxBackToLec'),onclick:function(){ App.rxRun=null; goBack(); }}));
    if(acts.firstChild) kids.push(acts);
  }
  if(R.titleKey==='rxReviewToday'){ // U-89: 一轮（20 件）で今日の分が終わったとは限らない。いまの予定で数え直して、残りがあれば次の一轮へ
    const left=rxQueue().list.length;
    if(left) kids.push(el('div',{class:'rx-left'},[ el('p',{class:'rx-hint jp',text:tf('rxReviewLeft',{n:left})}),
      el('button',{class:'btn rx-review-more',text:t('rxReviewToday'),onclick:rxReviewRun}) ]));
    else kids.push(el('div',{class:'rx-left rx-review-done'},[ el('p',{class:'rx-hint jp',text:t('rxReviewDone')}), // 残りが無い：分数の一行だけで画面が空だった（S8 persona 第二批）→ 終わった一言と次の一歩（ホームへ）
      el('button',{class:'btn rx-go-home',text:t('rxGoHome'),onclick:function(){ App.rxRun=null; goHome(); }}) ]));
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
function rxMarkWrong(text,wrong){
  const i=wrong?text.indexOf(wrong):-1;
  if(i<0) return el('span',{class:'jp',text:text});
  return el('span',{class:'jp'},[ document.createTextNode(text.slice(0,i)), el('mark',{class:'rx-wrong',text:wrong}), document.createTextNode(text.slice(i+wrong.length)) ]);
}
function rxMarkWrong2(text,wrong,a,b){ // 選んだ片段 [a,b) を淡い枠で、その中の誤り箇所 wrong を mark で：片段（助詞・句読点で切った選べる単位）と誤り箇所（改変した語）が一致しないことを見せる（S8 persona・Codex 両方が指摘）。判定は従来どおり「重なれば正解」
  const w0=wrong?text.indexOf(wrong):-1, w1=w0+(wrong||'').length;
  if(w0<0 || a==null || b==null || a>=b) return rxMarkWrong(text,wrong);
  const pts=[0,a,b,w0,w1,text.length].filter(function(x,i,arr){ return x>=0 && x<=text.length && arr.indexOf(x)===i; }).sort(function(x,y){ return x-y; });
  const top=[], pick=el('span',{class:'rx-seg-pick'});
  for(let i=0;i+1<pts.length;i++){ const x=pts[i], y=pts[i+1]; if(y<=x) continue; const piece=text.slice(x,y);
    const n=(x>=w0 && y<=w1)?el('mark',{class:'rx-wrong',text:piece}):document.createTextNode(piece);
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
    card?el('button',{class:'rx-tri-go jp',text:t('rxSeeCard'),onclick:function(){ renderRxLecture(App.rx.ix.cards[card].lec); rxGoCard(card,propId); }}):null ].filter(Boolean));
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
  const it={kind:'tf',props:[p.id],st:{}};
  it.render=function(box,after){
    const text=v?v.text:p.text, st=it.st, truth=!v; // finish（函数声明会提升）里要用 truth，必须先于任何调用声明
    box.appendChild(el('p',{class:'rx-stmt jp',text:text}));
    if(!st.done && !st.pickWhere){
      box.appendChild(el('div',{class:'rx-tf'},[
        el('button',{class:'opt jp rx-tf-o',text:t('rxSayTrue'),onclick:rxW(function(){ finish(true,null); })}),
        el('button',{class:'opt jp rx-tf-x',text:t('rxSayFalse'),onclick:rxW(function(){ if(v){ st.pickWhere=true; box.innerHTML=''; it.render(box,after); rxGuard(box); } else finish(false,null); })})
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
    box.appendChild(el('p',{class:'rx-stmt jp'},[ v?(segR?rxMarkWrong2(text,v.wrong,segR[0],segR[1]):rxMarkWrong(text,v.wrong)):el('span',{class:'jp',text:text}) ]));
    box.appendChild(el('p',{class:'rx-truth jp '+(truth?'t':'f'),text:truth?t('rxIsTrue'):t('rxIsFalse')})); // この文の正誤は題文の直下に（操作条には短い判定だけ：收尾第二轮 R-05）
    box.appendChild(rxVerdict(st.ok,st.dontKnow));
    if(v){
      box.appendChild(el('div',{class:'rx-var-c jp'},[ el('span',{class:'rx-var-lb',text:t('rxCorrectIs')}), document.createTextNode(v.correct||'') ]));
      if(v.tamper) box.appendChild(el('div',{class:'rx-tamper jp',text:t('rxTamper')+'：'+rxTamperName(v.tamper,App.rx.ix.tamper[v.tamper])}));
    }
    const ev=rxEvidence(p.id,[text, v&&v.correct]); if(ev) box.appendChild(ev);
    function finish(sayTrue,segIdx){ // sayTrue: true=○, false=×, null=わからない
      if(!canWrite()) return; // 判分の直前にもう一度（CR-01）
      let ok=false;
      if(sayTrue===true) ok=truth;
      else if(sayTrue===false){
        if(truth) ok=false;
        else { const segs=rxSegments(text); let at=0; for(let i=0;i<segIdx;i++) at+=segs[i].length;
               const w0=text.indexOf(v.wrong), w1=w0+v.wrong.length, s1=at+segs[segIdx].length;
               ok=(w0>=0 && at<w1 && s1>w0); }
      }
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
      if(part==='stem') box.appendChild(el('p',{class:'rx-stem jp',text:q.stem||''}));
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
    box.appendChild(rxVerdict(st.ok,st.dontKnow));
    // 逐肢反馈：判定・誤りの箇所・正しくは・改変の型・根拠（命題全文）。全肢を開いて出す（期末は同じ陳述の並べ替え：誤肢の「正しくは」を全部見せる。方案 4-4）。押すとたたむ
    const fb=el('div',{class:'rx-fb'});
    if(!st.fbOpen) st.fbOpen={};
    st.order.forEach(function(oi,k){
      const f=RX.optionFeedback(ix,q,oi);
      const open=(oi in st.fbOpen)?st.fbOpen[oi]:true;
      const why=f.correct?((q.options[oi]||{}).why||null):null; // 正肢の理由＝正肢自身の options[].why（方案 4-4。S1 の RX.whyCorrect(q) ができたら差し替え）。無ければ場所も取らない
      const det=el('div',{class:'rx-fb-d'},[
        why?el('div',{class:'rx-why jp',text:why}):null,
        f.fix?el('div',{class:'rx-var-c jp'},[ el('span',{class:'rx-var-lb',text:t('rxCorrectIs')}), document.createTextNode(f.fix) ]):null,
        f.tamper?el('div',{class:'rx-tamper jp',text:t('rxTamper')+'：'+rxTamperName(f.tamper.code,f.tamper.name)}):null,
        f.propId?rxEvidence(f.propId,[f.text, f.fix]):null
      ].filter(Boolean));
      const item=el('div',{class:'rx-fb-i '+(f.correct?'ok':'no')+(open?'':' rx-fold')});
      const head=el('button',{class:'rx-fb-h','aria-expanded':String(open),onclick:function(){
        const now=item.classList.toggle('rx-fold'); st.fbOpen[oi]=!now; head.setAttribute('aria-expanded',String(!now)); det.hidden=now; }},[
        el('span',{class:'rx-fb-k',text:'ABCDEF'[k]||''}), el('span',{class:'rx-fb-j',text:f.correct?'○':'×'}),
        f.correct?el('span',{class:'jp rx-fb-t',text:f.text}):el('span',{class:'rx-fb-t'},[ rxMarkWrong(f.text,f.wrong) ]) ]);
      det.hidden=!open;
      item.appendChild(head); if(det.childNodes.length) item.appendChild(det);
      fb.appendChild(item);
    });
    box.appendChild(fb);
    function submit(){
      const o0=box.querySelector('.opts'); st.optsY=o0?Math.round(o0.getBoundingClientRect().top+scrollY):null; // 答える前の選択肢の位置（文書座標）
      if(!canWrite()) return; // 判分の直前にもう一度（CR-01）
      const judged=RX.judge(q,st.picked), props=[];
      q.options.forEach(function(o,oi){ if(o.correct && o.prop) props.push({p:o.prop,ok:judged}); });
      st.picked.forEach(function(oi){ const o=q.options[oi]; if(!o.correct && o.prop) props.push({p:o.prop,ok:false}); });
      const one={}; props.forEach(function(x){ if(one[x.p]) one[x.p].ok=one[x.p].ok && x.ok; else one[x.p]=x; }); // 一題で同じ命題は一度だけ記録する（複選の正肢二つが同じ命題に挂かる題で seen が二つ進んでいた）
      const evs=Object.keys(one).map(function(k){ return one[k]; }).map(function(x){ const pe=ix.props[x.p]; const o=q.options.filter(function(y){ return y.prop===x.p; })[0];
        const ve=o&&o.variant&&ix.variants[o.variant];
        return {mode:q.type,props:[x.p],ok:x.ok,unsure:!!st.unsure,tamper:(!x.ok&&ve)?ve.variant.tamper:null,concepts:pe?pe.prop.concepts||[]:[]}; });
      if(evs.length && !rxRecord(evs)){ st.picked=[]; st.dontKnow=false; rxNotSaved(); box.innerHTML=''; it.render(box,after); return; } // 一題の全命題を一つの事務で。保存できなければ待答に戻す：選択も外す（N-D：残った選択に次の選択が足されて誤判定していた）
      st.done=true; st.ok=judged;
      box.innerHTML=''; it.render(box,after); after();
    }
  };
  return it;
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
    box.appendChild(el('p',{class:'rx-stmt jp'},[ rxMarkWrong(v.text,v.wrong) ])); // 誤った文は一度だけ（誤りの箇所に印。U-60：上下に二度出ていた）
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
