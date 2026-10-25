/* rx-vault.js ― 真题层（密文封套 quiz.enc.json）的解锁与使用。
 * 口令不写进任何存储；解密后的明文只在内存。IndexedDB 只存不可导出的 CryptoKey（每课一条，附盐值・迭代数・撤销代次）：
 * 设备级数据，不受单写者守卫，也不因此写本课 localStorage 键；回到旧版时旧版不认识这个库。
 * 加解密算法与参数＝quiz-envelope.js（与配布端同一份实现的逐字节副本）。
 * 撤销（本机锁定）的保证：撤销代次也存在 IndexedDB，「核对代次＋写钥匙」与「代次+1＋删钥匙」各在一个事务里完成，
 * 所以无论各标签怎样交错，被撤销之前开始的解锁都不能把钥匙写回去；广播只负责让各标签尽快清掉内存里的明文。 */
'use strict';

const RX_VAULT_DB='reviewx-vault', RX_VAULT_VER=2, RX_IDB={wait:8000}; // wait は回帰テストで短くする
/* 一次 IndexedDB 操作：work(stores, out) 在同一个事务里同步排好请求，结果放进 out.value。
 * 必定决着：超时会中止事务（写入回滚）；超时・blocked 之后才连上的迟到连接只关闭、不执行。 */
function rxIdb(mode,work){
  return new Promise(function(res,rej){
    if(!window.indexedDB) return rej(new Error('no indexedDB'));
    let settled=false, tx=null;
    const fin=function(f,v){ if(settled) return; settled=true; clearTimeout(tm); f(v); };
    const tm=setTimeout(function(){ if(tx){ try{ tx.abort(); }catch(_){} } fin(rej,new Error('indexedDB timeout')); },RX_IDB.wait);
    let open;
    try{ open=indexedDB.open(RX_VAULT_DB,RX_VAULT_VER); }catch(e){ return fin(rej,e); }
    open.onupgradeneeded=function(){
      const db=open.result;
      if(!db.objectStoreNames.contains('keys')) db.createObjectStore('keys',{keyPath:'course'});
      if(!db.objectStoreNames.contains('gens')) db.createObjectStore('gens',{keyPath:'course'});
    };
    open.onerror=function(){ fin(rej,open.error); };
    open.onblocked=function(){ fin(rej,new Error('indexedDB blocked')); };
    open.onsuccess=function(){
      const db=open.result;
      db.onversionchange=function(){ db.close(); };
      if(settled){ db.close(); return; } // 迟到的连接：什么也不做
      try{
        tx=db.transaction(['keys','gens'],mode);
        const out={value:undefined};
        work({keys:tx.objectStore('keys'),gens:tx.objectStore('gens')},out);
        tx.oncomplete=function(){ db.close(); fin(res,out.value); };
        tx.onerror=tx.onabort=function(){ db.close(); fin(rej,tx.error||new Error('indexedDB aborted')); };
      }catch(e){ try{ db.close(); }catch(_){} fin(rej,e); }
    };
  });
}
/* 钥匙记录与当前撤销代次的一致快照（同一事务内读） */
function rxIdbSnapshot(cid){
  return rxIdb('readonly',function(st,out){
    out.value={rec:null,gen:0};
    st.keys.get(cid).onsuccess=function(e){ out.value.rec=e.target.result||null; };
    st.gens.get(cid).onsuccess=function(e){ out.value.gen=(e.target.result&&e.target.result.gen)||0; };
  });
}
function rxIdbGet(cid){ return rxIdbSnapshot(cid).then(function(s){ return (s.rec && (s.rec.gen||0)===s.gen) ? s.rec : null; }); }
/* 写钥匙：同一事务里先核对撤销代次，不一致就不写（返回 false）。记录带写入操作 ID（取消时只删自己写的） */
function rxIdbPersist(cid,gen,rec){
  return rxIdb('readwrite',function(st,out){
    out.value=false;
    st.gens.get(cid).onsuccess=function(e){
      const cur=(e.target.result&&e.target.result.gen)||0;
      if(cur!==gen) return;
      st.keys.put({course:cid,salt:rec.salt,iterations:rec.iterations,key:rec.key,gen:gen,op:rec.op||null});
      out.value=true;
    };
  });
}
/* 撤销：同一事务里代次 +1 并删钥匙；返回新代次 */
function rxIdbRevoke(cid){
  return rxIdb('readwrite',function(st,out){
    st.gens.get(cid).onsuccess=function(e){
      const next=((e.target.result&&e.target.result.gen)||0)+1;
      st.gens.put({course:cid,gen:next}); st.keys.delete(cid);
      out.value=next;
    };
  });
}
/* 取消途中已写下的钥匙：同一事务里核对写入操作 ID，只删本任务写的那一条 */
function rxIdbDropIf(cid,op){
  return rxIdb('readwrite',function(st){
    st.keys.get(cid).onsuccess=function(e){ const r=e.target.result; if(r && op && r.op===op) st.keys.delete(cid); };
  });
}

/* ---------- 封套参数的入口校验：低于约定强度或形不对的封套一律不接（quiz-envelope.js 与配布端逐字节同一份，不在那里改） ---------- */
const RX_KDF_ITER_MIN=600000, RX_KDF_ITER_MAX=5000000; // 下限＝配布约定；上限防止异常大的次数把页面卡死
function rxB64Len(s){ try{ return (typeof s==='string' && s) ? atob(s).length : -1; }catch(e){ return -1; } }
function rxEnvProblem(env,courseId){
  if(!env || typeof env!=='object') return 'not an object';
  if(env.schema!=='rx-quiz-envelope/1') return 'schema';
  if(env.course!==courseId) return 'course';
  const k=env.kdf||{}, c=env.cipher||{};
  if(k.name!=='PBKDF2' || k.hash!=='SHA-256') return 'kdf';
  if(!Number.isInteger(k.iterations) || k.iterations<RX_KDF_ITER_MIN || k.iterations>RX_KDF_ITER_MAX) return 'iterations';
  if(rxB64Len(k.salt)<16) return 'salt';
  if(c.name!=='AES-GCM' || rxB64Len(c.iv)!==12) return 'iv';
  if(rxB64Len(env.ct)<17) return 'ct'; // GCM 标签 16 字节＋至少 1 字节
  return null;
}

/* ---------- 跨标签：撤销后广播新代次（BroadcastChannel；没有时用 storage 事件兜底）。
 * 收到比自己见过的更新的代次 → 进行中的任务作废、已解开的（代次更旧的）锁上；旧代次的迟到通知不影响之后开始的任务。 */
const RX_BC=(function(){ try{ return ('BroadcastChannel' in window)?new BroadcastChannel('reviewx-vault'):null; }catch(e){ return null; } })();
if(RX_BC) RX_BC.onmessage=function(e){ const d=e.data||{}; if(d.type==='revoke' && d.course) rxVaultRevoked(d.course,d.gen); };
window.addEventListener('storage',function(e){ // 通知用（設備級メタデータ、学習データではない）。重複して届いても冪等
  if(e.key && e.key.indexOf('rx-vault:revoked:')===0) rxVaultRevoked(e.key.slice(17),parseInt(e.newValue||'0',10)||0);
});
function rxVaultAnnounce(cid,gen){
  if(RX_BC) try{ RX_BC.postMessage({type:'revoke',course:cid,gen:gen}); }catch(e){}
  try{ localStorage.setItem('rx-vault:revoked:'+cid,String(gen)); }catch(e){}
}
function rxVaultRevoked(cid,gen){
  const R=App.rx; if(!R || !App.course || App.course.id!==cid) return;
  gen=gen||0;
  if(gen<=(R.revokedGen||0)) return;
  R.revokedGen=gen;
  if(R.vault && R.vault.state==='unlocked' && (R.vault.gen==null || R.vault.gen<gen)) rxVaultLockMem();
}

/* 一次解锁任务：同一课程实例・同一课程 ID・没有更新的任务・其间没有更新的撤销・（对话框）仍开着，才算有效。
 * task.gen＝从 IndexedDB 快照读到的代次；读到之前，见到任何新撤销即作废。 */
function rxVaultTask(R,cid,extra){
  const id=(R.vaultTask=(R.vaultTask||0)+1), seen=R.revokedGen||0;
  const task={ R:R, cid:cid, gen:null, op:id+'-'+Math.random().toString(36).slice(2),
    setGen:function(g){ if(!task.alive()) return false; task.gen=g; return true; }, // 快照の代次は、まだ有効なときだけ受け取る（作廃済みの任務を復活させない）
    alive:function(){
      if(App.rx!==R || !App.course || App.course.id!==cid || R.vaultTask!==id) return false;
      const rg=R.revokedGen||0;
      if(task.gen==null ? rg!==seen : rg>task.gen) return false;
      return !extra || extra();
    } };
  return task;
}

/* 课程加载后调用（不阻塞首页）：先建任务（等封套期间的撤销也能使它作废）→取封套→校验参数→本机有同代次・同盐的钥匙则免口令解开 */
async function rxVaultInit(){
  const R=App.rx; if(!R) return;
  const cid=App.course.id;
  R.vault={state:'none'};
  let env=null, bad=null;
  try{
    const r=await fetch(App.course.dir+'/quiz.enc.json',{cache:'no-store'});
    if(r.ok){ try{ env=JSON.parse(await r.text()); }catch(e){ bad='parse'; } }
  }catch(e){ /* 取れない（未配布・オフラインで未保存）＝真題層なし */ }
  if(App.rx!==R) return;                     // 封套の読み込みは課の実例だけで判断（撤销は自動解錠だけを取り消す）
  if(!bad && !env) return;
  if(!bad) bad=rxEnvProblem(env,cid);
  if(bad){ R.diag.push('quiz.enc.json: '+bad); R.vault={state:'invalid'}; return; } // 不接（练法与首页按没有真题层处理；设置里说明读不了，诊断进 dev 面板）
  R.vault={state:'locked',env:env,test:env.test===true};
  const task=rxVaultTask(R,cid); // 自動解錠の任務（ここから先の撤销で作廃）
  try{
    const snap=await rxIdbSnapshot(cid);
    if(!task.setGen(snap.gen)) return;
    const rec=snap.rec;
    if(task.alive() && rec && (rec.gen||0)===snap.gen && rec.salt===env.kdf.salt && rec.iterations===env.kdf.iterations){
      const plain=await rxVaultDecrypt(task,rec.key);
      if(plain && task.alive()) rxVaultUnlocked(R,plain,snap.gen);
    }
  }catch(e){ /* 钥匙对不上新封套（换了口令）・库不可用＝保持锁定 */ }
  rxVaultRefresh(R);
}
function rxVaultRefresh(R){ // 真題層の状態が決まったら、いま見ている画面を描き直す：首页（入口の文言）と回ページ（「演習」の 🔒 過去問）。深链で回ページに直達→封套が後から届く順でも入口が欠けない（S8 V-03）
  if(App.rx!==R) return;
  if(currentView===renderHome) renderHome();
  else if(document.querySelector('#view .rx-lecture[data-lec]') && typeof rerenderCurrent==='function') rerenderCurrent(); // 位置を保って描き直す
}
/* 解密；任务已作废时返回 null（GCM 校验失败＝口令不对或密文被改，照常 reject） */
async function rxVaultDecrypt(task,key){
  const b64=await RXQuizEnvelope.decryptWithKey(task.R.vault.env,key);
  if(!task.alive()) return null;
  const bin=atob(b64), bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}
function rxVaultUnlocked(R,plain,gen){ rxVaultApply(R,plain); R.vault.state='unlocked'; R.vault.gen=gen; }
/* 明文只在内存：真题错误肢的变体并入索引（逐肢反馈用）；真题陈述（冲刺排序用）。
 * 作答記録は配布しない（章程第 19 条）：個人の重点は rxPersonal（この端末の練習記録）が決める */
function rxVaultApply(R,plain){
  const ix=R.ix;
  R.quiz=plain; R.quizStmts={};
  (plain.variants||[]).forEach(function(v){ if(v && v.id && v.prop) ix.variants[v.id]={variant:v,prop:v.prop,quiz:true}; }); // quiz＝真題由来：練習だけで使い、カード表示・印刷・書き出しには出さない
  (plain.items||[]).forEach(function(q){ (q.options||[]).forEach(function(o){ if(o.prop) R.quizStmts[o.prop]=true; }); });
}
/* 内存里锁上：明文・并入的变体・真题陈述・个人重点全部丢掉，进行中的解锁作废；画面上若有真题（练习・模拟）就退回首页。
 * opt.keepModal：从设置里锁定时不动设置窗口（结果由 rxForget 在设置里显示） */
function rxVaultLockMem(opt){
  const R=App.rx; if(!R) return false;
  R.vaultTask=(R.vaultTask||0)+1;
  if(!R.vault || R.vault.state!=='unlocked') return false;
  ((R.quiz&&R.quiz.variants)||[]).forEach(function(v){ const e=v&&R.ix.variants[v.id]; if(e && e.variant===v) delete R.ix.variants[v.id]; });
  R.quiz=null; R.quizStmts={};
  R.vault.state='locked'; R.vault.gen=null;
  if(App.rxRun || document.querySelector('#view .rx-run')){ rxClearTimer(); App.rxRun=null; goHome(); toast(t('rxLocked')); } // 题目画面里可能有真题内容
  else if(!(opt&&opt.keepModal) && document.querySelector('#modalRoot .modal')){ closeModal(); rerenderCurrent(); }
  else rerenderCurrent();
  document.querySelectorAll('.nav-leave-fwd,.nav-leave-back').forEach(function(x){ try{ x.remove(); }catch(_){} }); // 转场的离场层里也可能留着真题
  return true;
}
function rxVaultState(){ return (App.rx && App.rx.vault && App.rx.vault.state) || 'none'; }

/* ---------- 解錠ダイアログ（既存の modal 基盤：Escape で閉じる・焦点は戻る） ----------
 * 顺序：快照（代次）→派生→解密（验口令）→钥匙落盘（事务内核对代次）→仍有效才装入明文并关窗。
 * 落盘过程中关了窗・切了课＝取消：不装入明文，把本任务刚写的钥匙删回去。 */
function rxUnlockDialog(){
  const R=App.rx; if(rxVaultState()!=='locked') return;
  const cid=App.course.id;
  const inp=el('input',{type:'password',class:'rx-pass',autocomplete:'off',spellcheck:'false',inputmode:'numeric',pattern:'[0-9]*','aria-label':t('rxPassLabel')}); // 口令＝4 桁以上の半角数字（章程第 20 条）：数字キーボード。長さは確かめない（正誤は復号が決める）
  const msg=el('p',{class:'rx-hint jp',role:'status','aria-live':'polite'});
  const go=el('button',{class:'btn',text:t('rxUnlockBtn')});
  const open=function(){ return inp.isConnected && !inp.closest('.closing'); }; // 对话框关了＝任务作废
  const run=async function(){
    const pass=inp.value.replace(/[０-９]/g,function(c){ return String.fromCharCode(c.charCodeAt(0)-0xFEE0); }); inp.value=''; // 全角数字は半角へ。口令は入力欄にも残さない
    if(!pass) return;
    const task=rxVaultTask(R,cid,open), env=R.vault.env;
    go.disabled=true; msg.textContent=t('rxUnlocking');
    try{
      let idbOk=true;
      let g;
      try{ g=(await rxIdbSnapshot(cid)).gen; }catch(e){ idbOk=false; g=R.revokedGen||0; } // 库不可用：只在内存里解开
      if(!task.setGen(g)) return;
      const key=await RXQuizEnvelope.deriveKey(pass,env.kdf.salt,env.kdf.iterations,false); // 不可导出
      if(!task.alive()) return;
      const plain=await rxVaultDecrypt(task,key);
      if(!plain) return;
      let saved=false;
      if(idbOk){
        try{ saved=await rxIdbPersist(cid,task.gen,{salt:env.kdf.salt,iterations:env.kdf.iterations,key:key,op:task.op}); }catch(e){ saved=null; }
        if(saved===false) return;                    // 期间被撤销：不解开
      }
      if(!task.alive()){ if(saved) rxIdbDropIf(cid,task.op).catch(function(){}); return; }
      rxVaultUnlocked(R,plain,task.gen);
      closeModal(); renderHome();
    }catch(e){ if(task.alive()){ msg.textContent=t('rxPassWrong'); go.disabled=false; inp.focus(); } }
  };
  go.addEventListener('click',run);
  inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); run(); } });
  const kids=[ el('p',{class:'sethelp jp',text:t('rxUnlockLead')}) ];
  if(R.vault.test) kids.push(el('p',{class:'rx-test jp',text:t('rxTestData')}));
  kids.push(el('label',{class:'setlbl jp',text:t('rxPassLabel')}), inp, go, msg);
  openModal(modalShell(t('rxUnlockTitle'),kids));
  setTimeout(function(){ inp.focus(); },60);
}
/* 本机锁定：内存先锁（进行中的解锁作废）→ 事务里代次 +1 并删钥匙 → 广播新代次。
 * 结果一律在设置里显示（不看设置窗口此刻是否还在）；失败时带重试。切到别的课之后才失败的，记在该课实例上。 */
async function rxForget(){
  if(rxBlindActive() && !(await rxBlindAsk())) return; // 期末模試の最中：ロックすると模試が消える（rxVaultLockMem が首頁へ戻す）ので、ほかの離れ方と同じ確認を先に（CR433-16 必修 2）。続けるなら何もしない
  const R=App.rx, cid=App.course.id;
  if(R && R.vault){ R.vault.forgetting=true; R.vault.forgetFailed=false; }
  rxVaultLockMem({keepModal:true});
  let ok=true, gen=0;
  try{ gen=await rxIdbRevoke(cid); }catch(e){ ok=!window.indexedDB; } // 库そのものが無い＝消す鍵も無い
  if(R && R.vault){ R.vault.forgetting=false; R.vault.forgetFailed=!ok; }
  if(ok){ if(R) R.revokedGen=Math.max(R.revokedGen||0,gen); rxVaultAnnounce(cid,gen); }
  if(App.rx===R) openSettings(); // 本人の操作の結果なので、閉じていても開き直して見せる
}
function rxVaultSettingsBlock(){
  const v=(App.rx&&App.rx.vault)||{state:'none'}, kids=[ el('div',{class:'setlbl jp',text:t('rxUnlockTitle')}) ];
  if(v.forgetFailed){
    kids.push(el('div',{class:'sethelp jp',role:'alert',text:t('rxForgetFail')}));
    kids.push(el('button',{class:'btn ghost sm',text:t('rxForget'),onclick:rxForget}));
  } else if(v.forgetting) kids.push(el('div',{class:'sethelp jp',role:'status',text:t('rxUnlocking')}));
  else if(v.state==='none') kids.push(el('div',{class:'sethelp jp',text:t('rxNoQuiz')}));
  else if(v.state==='invalid') kids.push(el('div',{class:'sethelp jp',text:t('rxQuizBad')}));
  else if(v.state==='locked'){
    kids.push(el('div',{class:'sethelp jp',text:t('rxUnlockLead')}));
    kids.push(el('button',{class:'btn ghost sm',text:t('rxUnlockBtn'),onclick:function(){ closeModal(); setTimeout(rxUnlockDialog,0); }}));
  } else {
    kids.push(el('div',{class:'sethelp jp',text:t('rxUnlocked')+(v.test?'（'+t('rxTestData')+'）':'')}));
    kids.push(el('button',{class:'btn ghost sm',text:t('rxForget'),onclick:rxForget}));
  }
  return el('div',{class:'setblk'},kids);
}

/* ---------- 真題の練習・まとめのテスト模擬 ---------- */
function rxQuizQ(it){ // 真题条目→出题对象（正解＝answer.no；选项每次乱序）
  const a=(it.answer||{}).no;
  return { id:it.id, type:'choice', layer:'quiz', stem:it.stem||'', select:1, case:null,
    options:(it.options||[]).map(function(o){ return {text:o.text,correct:o.no===a,prop:o.prop||null,variant:o.variant||null}; }) };
}
function rxQuizOf(lecId){ return ((App.rx.quiz&&App.rx.quiz.items)||[]).filter(function(q){ return q.id && q.id.indexOf(lecId+'-')===0; }); }
function rxMockRun(o){ // o.from＝'home'：首页の模試卡から（結果頁に「ホームへ戻る」：#28 の来路規則）。onclick に直掛けされた場合は第一引数が事件で from は取れず null＝鈕なし（旧 rxHomeExtras の .rx-mock は死码として 4.3.3 で撤去）
  const all=((App.rx.quiz&&App.rx.quiz.items)||[]);
  if(!all.length) return;
  const items=rxShuffle(all).map(function(q){ return rxQItem(rxQuizQ(q)); });
  rxRun('rxModeMock',items,null,{secPerItem:60,blind:true,from:(o&&o.from)||null}); // 整場盲答（4.3.3 #11・FX1-06）。from＝来た所（首页から始めた模試は結果の「ホームへ戻る」：#40）
}
