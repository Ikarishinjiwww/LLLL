'use strict';
function sectionHead(title,back,backLabel){ return el('div',{class:'sechd'},[ el('button',{class:'back',text:'‹ '+(backLabel||t('back')),onclick:back||goBack}), title?el('h2',{class:'jp',text:title}):null ]); } // 見出しは今いる画面の名前（無ければ出さない）。戻り先が分かるときは backLabel にその名
function chipTab(label,on,fn){ const b=el('button',{class:'chip'+(on?' on':''),text:label}); b.addEventListener('click',fn); return b; }
function rowBtn(main,cnt,fn){ const b=el('button',{class:'listrow'},[ el('span',{class:'main jp',style:'font-weight:600',text:main}), el('span',{class:'cnt',text:cnt}) ]); b.addEventListener('click',fn); return b; }

function wireChrome(){
  document.getElementById('langJa').addEventListener('click',()=>setLang('ja'));
  document.getElementById('langZh').addEventListener('click',()=>setLang('zh'));
  document.getElementById('helpBtn').addEventListener('click',openHelp);
  document.getElementById('brandBtn').addEventListener('click',()=>{ if(App.idx) goHome(); });
  document.getElementById('courseBtn').addEventListener('click',openCourseSwitch);
  document.getElementById('setBtn').addEventListener('click',openSettings);
  var _mb=document.getElementById('moreBtn'); if(_mb) _mb.addEventListener('click',openTbMenu);
  var _tc=document.getElementById('tocBtn'); if(_tc) _tc.addEventListener('click',function(){ if(typeof App.tocOpen!=='function') return; try{ _tc.focus({preventScroll:true}); }catch(_){} // Safari は押したボタンに焦点を置かない：閉じたら目次ボタンへ戻すため先に置く
    App.tocOpen(); _tc.setAttribute('aria-expanded','true'); }); // 新課回次页の目次（N-03） // 狭い顶栏：「?」「設定」「日／中」を「…」に（S6 U-04）
  var _vb=document.getElementById('verBadge'); if(_vb) _vb.addEventListener('click',openUpdates); /* 版本 chip 已移出顶栏；更新履歴入口在设置 */
  refreshChrome();
}
function rerenderCurrent(){ // re-render the current view in place (preserve sub-state); fixes lang-switch jumping home
  if(!App.idx){ if(typeof App.errView==='function') App.errView(); return; } // 課がまだ無い＝起動時のエラー画面：その画面を描き直す（X14-01）
  if(App.session && document.querySelector('.runner')){ renderRunner(); return; }
  const y=window.scrollY; // その場で描き直す＝位置も保つ（書き手になった直後の描き直しで、跳んだ先から先頭へ戻されない：S6 U-10）
  if(typeof currentView==='function'){ keepScroll=true; currentView(); keepScroll=false; window.scrollTo(0,y); return; }
  renderHome();
}

let modalOpener=null;
let lastPressed=null; // Safari は押したボタンに焦点を置かない（activeElement＝body）。閉じたあと焦点を返す先の後備として、最後に押したボタンを覚える
document.addEventListener('pointerdown',function(e){ const b=e.target&&e.target.closest&&e.target.closest('button,[role="button"],a[href]'); if(b) lastPressed=b; },true);
function returnTarget(){ const a=document.activeElement; return (a && a!==document.body && a!==document.documentElement) ? a : (lastPressed && lastPressed.isConnected ? lastPressed : a); }
function openModal(node,keepEls){ // keepEls：対話框の間も操作できるまま残す要素（只読の説明の間の書き手の帯：U-25）
  const root=document.getElementById('modalRoot');
  const prev=root.firstElementChild;
  if(prev && !prev.__inertPopped){ prev.__inertPopped=true; setBackdropInert(false); } // closeModal を経ずに差し替えられる開き直しでも棧を漏らさない
  root.innerHTML='';
  modalOpener=returnTarget();                               /* 閉じたら元の場所へ帰す（Safari は押したボタンが焦点を持たないので後備あり） */
  const m=el('div',{class:'modal',onclick:function(e){ if(e.target===m && !m.querySelector('[data-recovery]')) closeModal(); }},[ node ]); // 恢復框は外側を押しても閉じない（閉じるボタンか Esc だけ：N5-05）
  const card=node&&node.classList&&node.classList.contains('modal-in')?node:(node?node.querySelector&&node.querySelector('.modal-in'):null);
  if(card){
    card.setAttribute('role','dialog'); card.setAttribute('aria-modal','true'); card.setAttribute('tabindex','-1');
    const h=card.querySelector('h3,h2,.mtitle');
    if(h){ if(!h.id) h.id='modalTitle_'+Date.now(); card.setAttribute('aria-labelledby',h.id); }
  }
  root.appendChild(m);
  m.__inertPopped=false; setBackdropInert(true,[root].concat((keepEls||[]).filter(Boolean))); trapFocus(m); // 背景を inert+aria-hidden で封鎖し, Tab をモーダル内で循環 — 真のフォーカス境界
  setTimeout(function(){ try{ (card||m).focus(); }catch(e){} },0);
  if(typeof navSync==='function') navSync(); // 対話框が開いているあいだは「戻る」でまず閉じる（U-38）
}
function closeModal(force){
  const root=document.getElementById('modalRoot'); const m=root.firstElementChild;
  if(force!==true && typeof updateGateOn!=='undefined' && updateGateOn && m && m.querySelector && m.querySelector('[data-update-gate]')) return; // 更新後の確認門は門のボタンでしか閉じない（外側の押下・Esc・戻る：WLR1 合并裁定 三-8）
  document.body.classList.remove('ro-notice-open');
  if(!m) return;
  if(!m.__inertPopped){ m.__inertPopped=true; setBackdropInert(false); } // 一度きりの巻き戻し (reduced-motion 早退・closing 二重呼びの両方に安全)
  const back=modalOpener; modalOpener=null;
  const tcb=document.getElementById('tocBtn'); if(tcb) tcb.setAttribute('aria-expanded','false'); // 目次の開閉状態（N-03）
  setTimeout(function(){ try{ if(back&&back.isConnected&&back.focus) back.focus(); }catch(e){} },0);
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){ root.innerHTML=''; if(typeof navSync==='function') navSync(); return; }
  if(m.classList.contains('closing')) return;
  m.classList.add('closing'); if(typeof navSync==='function') navSync();
  let done=false;
  const fin=function(){ if(done) return; done=true; if(m.parentNode) m.parentNode.removeChild(m); }; // 只移除本浮层, 避免误删随后重开的浮层
  const card=m.querySelector('.modal-in')||m;
  card.addEventListener('animationend', fin, {once:true});
  setTimeout(fin, 500); // 兜底: animationend 不触发也必清
}
function modalShell(title,body){ const bd=el('div',{class:'modal-bd'}); const inner=el('div',{class:'modal-in has-hd'},[ el('div',{class:'modal-hd'},[ el('h3',{class:'jp',text:title}), el('button',{class:'modal-x',text:'×','aria-label':t('close'),onclick:closeModal}) ]), bd ]); (Array.isArray(body)?body:[body]).forEach(b=>bd.appendChild(b)); return inner; } // 頭（見出し・×）と本文の二段：本文だけが流れ、頭は滚动区の外（真 Safari で頭の下に文字が透けていた：收尾清单 F-04）

/* 神経の「使い方」。臨床(問題を解く道具)とは使い方そのものが違うので、説明も別に書く。
 * 臨床の文面をそのまま出すと「模擬試験」「苦手を重点的に」など、この課には無い機能の話になる。 */
function helpSecsNeuro(){
  const nq=(App.questions||[]).length;   /* 問題数を直書きすると、増題した瞬間に説明書が嘘をつく */
  return (t('helpNeuro')||[]).map(function(x){ return {ic:x.ic,t:x.t,h:x.h.replace('{n}',nq)}; });
}
function openHelp(){
  const ic={ exam:ICONS.exam, wrong:ICONS.wrong, weakwrong:NEW_ICONS.weakwrong, cards:NEW_ICONS.cards, book:NEW_ICONS.book, gear:NEW_ICONS.gear,
    search:NEW_ICONS.search, refresh:NEW_ICONS.refresh, cal:NEW_ICONS.cal, lock:NEW_ICONS.lock, share:NEW_ICONS.share,
    kbd:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>' };
  const body=[];
  const secs=(typeof isRxCourse==='function'&&isRxCourse()) ? (t('helpSecsRx')||[]) // U-05: 新课は臨床の使い方を出さない
    : (App.course&&App.course.shape==='reader') ? helpSecsNeuro() : (t('helpSecs')||[]);
  secs.forEach(function(sec){
    body.push(el('div',{class:'helpsec'},[
      el('h4',{class:'jp'},[ el('span',{class:'hc',html:ic[sec.ic]||ic.gear}), document.createTextNode(sec.t) ]),
      el('p',{class:'jp',html:sec.h})
    ]));
  });
  openModal(modalShell(t('helpTitle'),body));
}

function ioBlock(withReset){ withReset=(withReset!==false); // 设置面板 & 结果页 IO modal 共用; 設定パネルは false で reset を末尾の独立ブロックに分離
  const includeChk=el('input',{type:'checkbox'});
  const arr=[
    el('p',{class:'muted jp',text:t('ioNote')}),
    el('label',{class:'checkline'},[ includeChk, document.createTextNode(t('includeRaw')) ]),
    el('div',{class:'row'},[
      el('button',{class:'btn',text:t('export'),onclick:()=>doExport(includeChk.checked)}),
      (function(){ // display:none の file input を包む label は Tab 順に乗らない → 本物の button から .click() で開く
        const inp=el('input',{type:'file',accept:'application/json,.json',style:'display:none'}); inp.addEventListener('change',doImport);
        const btn=el('button',{type:'button',class:'btn ghost',text:t('importBtn'),onclick:function(){ inp.value=''; inp.click(); }}); // value='' で同一ファイルの再取込も change が飛ぶ
        return el('span',{style:'display:contents'},[ btn, inp ]); })()
    ])
  ];
  if(importBackupHasSig()){ // 直前の取り込みが戻せる間だけ出す：要約の無い退避（降級した取り込み・戻しも失敗した取り込み・4.2.0 以前の退避）は照合できず必ず断るので出さない（快審第三十五批 三・総指揮定 甲）
    arr.push(el('button',{class:'btn ghost sm',style:'margin-top:8px',text:t('impUndo'),onclick:undoImport}));
  }
  if(withReset){ arr.push(
    el('hr',{style:'border:none;border-top:1px dashed var(--line);margin:16px 0'}),
    el('div',{class:'rubt jp',text:t('resetTitle')}),
    el('div',{class:'row'},[ // 二段リセット（軽=進捗のみ／重=全ローカルデータ、文案どおり）
      el('button',{class:'btn ghost',text:t('resetProg'),onclick:doResetProgress}),
      el('button',{class:'btn ghost',style:'border-color:var(--no-line);color:var(--no-deep)',text:t('reset'),onclick:doReset})
    ])
  ); }
  return arr;
}
function openIO(){ openModal(modalShell(t('ioTitle'),ioBlock())); }
/* ---------- 完全バックアップ v2（データ字典＝課の名前空間の全鍵） ---------- */
const IMPORT_BACKUP_KEYS=['progress','examInProgress','helpSeen','lastRead','readerFs','readerBm','examDate','bookmarks','examHistory','sched','rx:sched','rx:stats','rx:log','rx:read']; // 旧課の取り込みの退避＝4.2.0 の COURSE_KEYS と同じ集合（WLR-B3：退避を 4.2.0 より長くしない）
const COURSE_KEYS=['progress','examInProgress','helpSeen','lastRead','readerFs','readerBm','examDate','bookmarks','examHistory','sched','rx:sched','rx:stats','rx:log','rx:read','rx:view']; // rx:*＝新課の学習状態（重い方のリセットで消す：S6 R21）。rx:view＝回のページの表示（読む／覚える：ux/render） // sched＝旧課の間隔復習（S1-d。旧版の読み手は知らない鍵として無視）
function normBookmarks(v){ // しるしの保存形は {題番号:true}。取り込みは保存形（2.3.2 以来の書き出しはこれ）と配列形の両方を受け、保存形へ揃える
  if(Array.isArray(v)){ if(!v.every(function(x){ return typeof x==='string'; })) return null; const o={}; v.forEach(function(id){ o[id]=true; }); return o; }
  if(v&&typeof v==='object'){ const o={}; Object.keys(v).forEach(function(id){ if(v[id]) o[id]=true; }); return o; }
  return null;
}
const EXTRA_NORM={ bookmarks:normBookmarks }; // 取り込み時に保存形へ揃える鍵
const EXTRA_SPEC={ // 取り込み時の型白名单（progress は engine の deserialize が別途厳格処理）
  examInProgress:function(v){ return v===null||typeof v==='object'; },
  helpSeen:function(v){ return typeof v==='boolean'; },
  lastRead:function(v){ return v&&typeof v==='object'&&typeof v.kai==='number'; },
  readerFs:function(v){ return typeof v==='number'||typeof v==='string'; },
  readerBm:function(v){ return Array.isArray(v)&&v.every(function(x){return typeof x==='string';}); },
  examDate:function(v){ return typeof v==='string'&&v.length<40; },
  bookmarks:function(v){ return normBookmarks(v)!==null; },
  examHistory:function(v){ return Array.isArray(v)&&v.every(function(x){ return x&&typeof x==='object'&&typeof x.at==='number'&&typeof x.total==='number'&&Array.isArray(x.wrongIds); }); },
  sched:function(v){ return spValidStored(v); }
};
function exportPayload(includeRaw){
  return C.serializeProgress(App.progress,{courseId:App.course.id,schemaVersion:PROGRESS_SCHEMA,appVersion:APP_VERSION},{includeRawAnswers:includeRaw});
}
function buildExportV2(includeRaw){ // v1 本体＋extras 全鍵＝完全バックアップ（v1 読み手とも互換）
  const payload=exportPayload(includeRaw);
  if(isRxCourse()) payload.rx=rxExportState(); // 新課の学習状態（旧版の読み手は未知の節として無視）
  payload.exportSchema=2;
  payload.exportedAt=new Date().toISOString();
  payload.extras={};
  Object.keys(EXTRA_SPEC).forEach(function(k){
    const v=lsGet(nk(k),null);
    if(v!==null) payload.extras[k]=v;
  });
  if(!includeRaw) stripExamRaws(payload.extras); // 手書きの答えを含めない書き出し：進行中の模試の記述（perItem.*.raw）も外す（Codex FX1-09：これまで extras にそのまま出ていた）
  return payload;
}
function stripExamRaws(extras){ // 書き出しの写しだけを変える（保存済みの模試は触らない）。続きから再開すると記述欄が空になる＝「手書きの答えを含めない」の意味どおり
  const e=extras.examInProgress;
  if(!e || typeof e!=='object' || !e.perItem || typeof e.perItem!=='object') return;
  const pi={};
  Object.keys(e.perItem).forEach(function(id){ const st=e.perItem[id]; if(st && typeof st==='object'){ const c=Object.assign({},st); delete c.raw; pi[id]=c; } else pi[id]=st; });
  extras.examInProgress=Object.assign({},e,{perItem:pi});
}
function restoreRaw(data,keys){ // 退避した生データを本課の各鍵へ書き戻す。書き手でなくなったら即やめる。戻り値＝全部戻せたか（keys 省略＝旧課の鍵一式）
  if(!holdsWriter()) return false;
  let ok=true;
  (keys||COURSE_KEYS).forEach(function(k){ if(!ok) return; const v=(data[k]===undefined)?null:data[k];
    let cur; try{ cur=localStorage.getItem(nk(k)); }catch(e){ cur=undefined; }
    if(cur===v){ noteSave(nk(k),true); return; } // もう同じ：書かない（書けない鍵があっても、変わっていなければ戻せたことになる。書けずにいた印も外す）
    ok=(v===null)?lsDel(nk(k)):lsSetRaw(nk(k),v); });
  return ok;
}
/* 取り消しの前提（合成稿四・WLR1 WL-02・WLR2 必修 1・WLR-B2 WLB2-01）：取り込みで書く学習データの鍵の値の要約（sig：長さ＋64 ビット散列）を、書く前に退避へ残す（全文は持たない：退避は 4.2.0 とほぼ同じ大きさ、正文の空きを食わない）。
 * 取り消しは同じ同期処理の中で一鍵ずつ今の値と比べ、一つでも変わっていれば戻さない（取り込み後に保存した作答を消さない）。設定・読む位置（helpSeen・lastRead・readerFs・rx:read）は比べない */
const UNDO_CHECK_KEYS=['progress','examInProgress','readerBm','examDate','bookmarks','examHistory','sched','rx:sched','rx:stats','rx:log'];
function importSig(v){ if(v==null) return null; v=String(v); let h1=0xdeadbeef^v.length, h2=0x41c6ce57^v.length; // 値の要約（長さ＋64 ビット散列）：取り込み後に変わったかを照合するだけに使う
  for(let i=0;i<v.length;i++){ const c=v.charCodeAt(i); h1=Math.imul(h1^c,2654435761); h2=Math.imul(h2^c,1597334677); }
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909); h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return v.length.toString(36)+'.'+(h2>>>0).toString(36)+'.'+(h1>>>0).toString(36); }
function importUnchanged(b,keys){ // 取り消してよいか：各鍵の今の値が取り込んだ値（sig）のまま。途中で止まった（pending）ときは取り込み前の値（data）でもよい（取り込み・取り消しの途中）
  // sig の無いバックアップ（古い版）と読めない鍵は「照合できない」＝戻さない。pending でも照合は省かない（WLR2 必修 1：取り込み後に保存した作答を消さない）
  if(!b || !b.sig || !b.data) return false;
  return keys.every(function(k){ if(!(k in b.sig)) return true; let cur; try{ cur=localStorage.getItem(nk(k)); }catch(e){ return false; }
    return importSig(cur)===b.sig[k] || (b.state==='pending' && cur===(b.data[k]===undefined?null:b.data[k])); }); }
function importBlocked(){ const b=lsGet(nk('importBackup'),null); return !!(b && b.state==='pending' && importUnchanged(b,b.keys||UNDO_CHECK_KEYS)); } // 前回の取り込み／取り消しが途中で止まり、取り消しで安全に戻せる（照合が通る）あいだだけ次の取り込みを止める（印はバックアップと一体なので、再読み込みしても・別のタブが書き手になっても残る）。取り込み後に記録が変わった・照合できないなら止めない：取り消しは拒まれるので、ファイルからの取り込みを出口に残す（WLR2 必修 1）
function markBackup(b,state,raw){ // バックアップに状態の印をつけて保存し、読み戻して確かめる（pending＝本課のデータがバックアップと食い違っているかもしれない）。raw＝容量の閘を通さない（印の付け替え＝長さはほぼ同じ：完了・取り消しの道を閘で止めない）
  const nb=Object.assign({},b,{state:state});
  if(!(raw?lsSetRaw(nk('importBackup'),JSON.stringify(nb)):lsSet(nk('importBackup'),nb))) return false;
  const r=lsGet(nk('importBackup'),null); return !!(r && r.state===state && r.at===nb.at);
}
function importBackupStart(backup,sig){ // 退避を「途中」の印つきで残す。戻り値：'sig'＝要約つき（取り消しは照合つきで出せる）・'plain'＝要約なし（4.2.0 と同じ大きさ以下：この取り込みは取り消しを出さない）・null＝退避できない（始めない：4.2.0 と同じ）
  if(markBackup(Object.assign(backup,{sig:sig}),'pending')) return 'sig';
  delete backup.sig; return markBackup(backup,'pending')?'plain':null; } // 要約の分だけ入らない：4.2.0 で入る退避なら入れて進む（WLR-B3 WLB3-01）。起步は原位置替換だけ：盤上は上一次の取り込みの退避なので消さない（入らなければ中止、上一次の撤销材料は残る：4.2.0 と同じ。WLR-B4 WLB4-01）
function importDowngrade(backup){ // 取り込みの途中で：盤上の今回の要約つき退避を、原位置で要約なしに縮めて書き直す（容量の下でも縮む書き込みは通る）。先に消すことはしない：書けない（容量以外の故障）なら盤上の要約つき退避をそのまま残し、記憶もそれに合わせる（WLR-B4 WLB4-02）
  const sig=backup.sig; delete backup.sig; if(markBackup(backup,'pending')) return true; backup.sig=sig; return false; }
function importSigBack(backup,sig){ if(importBackupHasSig()) return; backup.sig=sig; markBackup(backup,'pending',true); } // 戻しが失敗した：盤上の退避が今回降級した要約なしなら、要約を一度だけ書き戻す。書ければ再導入は止まり、撤销は照合つきで取り込み前に戻せる（WLR-B4 WLB4-03）
function importPut(backup,fn){ if(fn()) return true; return !!backup.sig && importDowngrade(backup) && fn(); } // 正文の一歩が書けない：要約つきの退避なら要約を外して空きを返し、その一歩だけやり直す
function importBackupDrop(backup){ if(!lsDel(nk('importBackup'))) markBackup(backup,'done',true); } // 取り消すものが無い（戻せた失敗）：退避を外す。消せなければ印だけ外す
function importBackupHasSig(){ const b=lsGet(nk('importBackup'),null); return !!(b && b.sig); } // 盤上の退避が要約つきか（降級を試みて書けなかったとき、記憶の退避と盤上が食い違うので盤上で決める）
function importBackupDone(backup){ // 書き終わった。戻り値＝この取り込みを取り消せるか。要約つきなら印を外す（縮む書き込み；外せなければ pending のまま、取り消しは照合つき）。要約なし（降級）なら退避を消す：照合できない取り消しは出さない
  if(backup.sig){ markBackup(backup,'done',true); return true; }
  if(!lsDel(nk('importBackup'))) markBackup(backup,'done',true); return false; }
function restoreFailKey(err){ return err && err.noUndo ? 'impRestoreFailedNoUndo' : 'impRestoreFailed'; } // 戻しきれなかった取り込みの知らせ：要約つきの退避なら「取り消しで戻す・今は取り込めない」、要約なし（降級）ならそれを言わない（WLR-B4）
function importForThisCourse(obj){ // このファイルをこの課に取り込んでよいか（B-057・X15-01：プレビューと旧課・新課の取り込みで共通）
  if(!obj || typeof obj!=='object') return false;
  if(Object.prototype.hasOwnProperty.call(obj,'courseId')) return typeof obj.courseId==='string' && obj.courseId!=='' && obj.courseId===App.course.id; // 欄があれば有効な文字列でこの課の ID（空・null・false・0 などは拒む）
  return !isRxCourse() && !(typeof obj.exportSchema==='number' && obj.exportSchema>=2) && !('extras' in obj); // 欄が無いのは旧 v1 形式（exportSchema が無いか 2 未満で、extras も無い：このアプリの v1／v2 の見分けと同じ）を旧課に取り込むときだけ
}
function impCourseName(cid){ const c=courseList().filter(function(x){ return x.id===cid; })[0]; return (c&&c.title&&(c.title.ja||L(c.title)))||cid||'?'; } // 課程名は日本語の正式名（章程第 22 条）。内部 ID は見せない
function impLocalTime(iso){ const d=new Date(iso); if(isNaN(d)) return String(iso); const p=function(x){ return String(x).padStart(2,'0'); };
  return d.getFullYear()+'/'+p(d.getMonth()+1)+'/'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); } // UTC の ISO 文字列ではなく端末の現地時刻
function wrongCourseText(courseId){ // 取り込めない理由と、できること：課程リストにある課なら切り替え先を示す
  const c=courseList().filter(function(x){ return x.id===courseId; })[0], name=c&&c.title&&c.title.ja;
  return t('impWrongCourse')+(name?tf('impSwitchHint',{c:name}):'');
}
function applyImportPayload(obj){ // 検証→自動バックアップ（必須）→全件書き込み→最後に欠席鍵を削除。どこかで失敗したら元へ戻して投げる
  if(!quotaAdmit) return quotaAdmitted(applyImportPayload,this,arguments); // 軟い容量の閘は新しい作答だけを止める：利用者が選んだ取り込み（退避・書き込み・戻し）は 4.2.0 と同じく実際の上限だけで決まる（WLR3 必改 1）
  if(importBlocked()) throw Object.assign(new Error('import blocked'),{restoreFailed:true});
  if(!holdsWriter()) throw writerOk ? Object.assign(new Error(t('storageBlocked')),{plain:true}) : Object.assign(new Error('not writer'),{ownershipLost:true}); // 書き手のまま札が読めない＝保存の故障：そう知らせる（失権なら黙って帯に任せる）
  if(isRxCourse()){ const r=rxApplyImport(obj); dataReplaced(); return r; } // 新課は rx-views.js（同じ印つきバックアップと書き手確認を使う）。成功したら離页で古い値を書き戻さない
  const parsed=C.deserializeProgress(obj);
  if(!importForThisCourse(obj)) throw Object.assign(new Error(t('impWrongCourse')),{plain:true}); // 別の課のファイル・課程 ID が無効なファイルは一つも書かずに拒む（直接呼ばれても：B-057・X15-01）
  if(obj.exportSchema>=2 && obj.extras && typeof obj.extras==='object' && ('sched' in obj.extras) && !EXTRA_SPEC.sched(obj.extras.sched))
    throw new Error((t('fieldNames')||{}).sched||'sched'); // X16-01：復習の予定は進度と組で意味を持つ。不合格なら備份も書き込みも始めず、ファイルごと拒む（「形式が不正です: 復習の予定」）
  const rawBackup={};
  IMPORT_BACKUP_KEYS.forEach(function(k){ rawBackup[k]=localStorage.getItem(nk(k)); }); // 退避の鍵は 4.2.0 と同じ（rx:view は表示の好みで取り込みは触れない）：要約を外した退避は 4.2.0 と同じ長さ（WLR-B3）
  const next=C.normalizeProgress(Object.assign(emptyProgress(),parsed.progress,{cardMarks:(obj&&obj.cardMarks)||{},hideLearned:!!(obj&&obj.hideLearned)}),PROGRESS_SCHEMA);
  const plan=[['progress',next]],skipped=[],drop=[]; // 書く値を先に決める：取り消しの照合用の要約（sig）を、書く前に退避へ入れる（WLR2 必修 1・WLR-B2 WLB2-01）
  if(obj.exportSchema>=2 && obj.extras && typeof obj.extras==='object'){
    Object.keys(EXTRA_SPEC).forEach(function(k){
      if(!(k in obj.extras)){ drop.push(k); return; } // v2 は全鍵を書き出す形式：ファイルに無い鍵は書き出し時に空だった
      const v=obj.extras[k];
      if(EXTRA_SPEC[k](v)) plan.push([k,EXTRA_NORM[k]?EXTRA_NORM[k](v):v]); else skipped.push(k);
    });
  }
  const sig={}; UNDO_CHECK_KEYS.forEach(function(k){ sig[k]=importSig(rawBackup[k]===undefined?null:rawBackup[k]); });
  plan.forEach(function(x){ if(x[0] in sig) sig[x[0]]=importSig(JSON.stringify(x[1])); }); drop.forEach(function(k){ if(k in sig) sig[k]=null; });
  const backup={at:new Date().toISOString(),data:rawBackup};
  const hadBackupMark=hasUnsaved(nk('importBackup')); // 前から書けずにいた退避印（印が「途中」のまま残っている真の未決）は、今回の中止で消さない（X15f-01）
  const bmode=importBackupStart(backup,sig);
  if(!bmode){ if(!hadBackupMark) forgetUnsaved(nk('importBackup')); throw writerOk ? Object.assign(new Error(t('storageBlocked')),{plain:true}) : Object.assign(new Error('backup not saved'),{ownershipLost:true}); } // 本課の鍵を変える前に、バックアップを「途中」の印つきで残せたと確かめる。できなければ始めない（学習データに触れる前の中止なので、退避印の「書けずにいた」は外す：X15e-01）
  const applied=[];
  try{
    plan.forEach(function(x){ if(!importPut(backup,function(){ return lsSet(nk(x[0]),x[1]); })) throw new Error(x[0]+' not saved'); if(x[0]==='progress') App.progress=x[1]; applied.push(x[0]); });
    drop.forEach(function(k){ if(!lsDel(nk(k))) throw new Error(k+' not removed'); }); // 全部書けてから消す
    pendingMigration=null; delProgressBackups(); // 取り込み＝利用者が明示的に選んだ復元。迁移待ちと迁移前备份は解消
  }catch(err){
    if(!writerOk || fenceState()==='lost'){ if(writerOk) setWriter(false); loadProgress(); err.ownershipLost=true; throw err; } // 本当に書き手を外れたときだけ巻き戻さない（新しい書き手のデータを上書きしない。印は残り、次の書き手も取り込みを止める）。札が読めないだけ（保存の故障）なら巻き戻しを試す
    const restored=restoreRaw(rawBackup);
    loadProgress();
    if(restored){ importBackupDrop(backup); throw Object.assign(new Error(t('rxImpFail')),{plain:true}); } // 戻せた：印を外し、元のままだと知らせる（「形式が不正です」とは言わない）
    else if(writerOk){ importSigBack(backup,sig); err.restoreFailed=true; err.noUndo=!importBackupHasSig(); } else err.ownershipLost=true; // 戻しきれない：印つきのバックアップ（取り込み前の全データ）が残る。要約なし（降級）なら取り消しは照合できず、次の取り込みも止めない：知らせを替える（impRestoreFailedNoUndo）
    throw err;
  }
  const noUndo=!importBackupDone(backup); // 完了：印を外す。降級した取り込みは退避を消し、取り消せないと知らせる（impNoUndo）
  dataReplaced(); // 離页で記憶の古い値を書き戻さない（呼び手が再読み込み前の後始末をしなくても）
  return {applied:applied,skipped:skipped,noUndo:noUndo};
}
function sentenceJoin(a,b){ a=String(a||''); return a+(/[。．.!！?？]$/.test(a)?'':'。')+b; } // 二つの文をつなぐ：半角空白は入れず、前の文が句点で終わらなければ「。」を補う（ja・zh とも「。」）
function showImportSkipped(){ // 取り込み直後の再読み込みで一度だけ：取り込めなかった類別を知らせる（黙って捨てない）
  let list=null, noUndo=false; try{ list=JSON.parse(sessionStorage.getItem('quiz:impSkipped')||'null'); sessionStorage.removeItem('quiz:impSkipped'); noUndo=sessionStorage.getItem('quiz:impNoUndo')==='1'; sessionStorage.removeItem('quiz:impNoUndo'); }catch(_){}
  if(!Array.isArray(list)) return;
  const names=t('fieldNames')||{}; const shown=list.map(function(k){ return names[k]; }).filter(Boolean); // 表示名のない鍵（読みの設定など）は数えない
  const head=shown.length?t('impSkippedToast').replace('{list}',shown.join('、')):t('impDone'); // 取り込みが済んだことを一度だけ知らせる（S6 U-18）
  toast(noUndo?sentenceJoin(head,t('impNoUndo')):head); // この取り込みは取り消せない（空きが足りず要約つきの控えを残せなかった）：同じ知らせに続けて言う（WLR-B3）
}
async function undoImport(){ if(!holdsWriter()) return; // 画面の「直前の取り込みを取り消す」：先に確かめる（WLR1 合并裁定 一・Claude WL-02）。確かめたら同じ同期処理の中で現値を照合して戻す
  if(!(await askConfirm(t('impUndo'),t('impUndoConfirm'),t('impUndo'),true))) return;
  if(!(await afterConfirm())) return;
  undoImportNow();
}
function undoImportNow(){ if(!holdsWriter()) return; // 直前の取り込みを 1 段だけ戻す（書き手であることを札まで確かめてから）
  if(isRxCourse()) return rxUndoImport();
  const b=lsGet(nk('importBackup'),null);
  if(!b||!b.data){ alert(t('impNoBackup')); return; }
  if(!b.sig){ alert(t('impUndoUnverified')); return; } // 取り込んだ値の要約が無い（古い版の退避）：照合できないので戻さない（WLR2 必修 1）
  if(!importUnchanged(b,UNDO_CHECK_KEYS)){ alert(t('impUndoChanged')); return; } // 取り込みのあとに記録が変わった：戻せば消える。戻さず、書き出したファイルからの復元を案内する（WLR1 WL-02）
  if(!markBackup(b,'pending',true)){ if(writerOk) alert(t('impRestoreFailed')); return; } // 書き戻す前に「途中」の印を残せたと確かめる。できなければ何も変えない
  if(!restoreRaw(b.data)){ loadProgress(); if(writerOk) alert(t('impRestoreFailed')); return; } // 途中で止まった：印つきのバックアップは消さない
  lsDel(nk('importBackup'));
  dataReplaced(); location.reload();
}
function buildExportAIPrompt(){
  if(isRxCourse()) return rxExportAIPrompt(); // 新課は rx:sched・rx:stats から（旧課の wrong は新課では空のまま）
  // 从累计错题反查 回 / section / 概念, 自动生成 AI 提示词 + 结构化材料清单
  const wrongIds=Object.keys(App.progress.wrong||{});
  const kaiSet=new Set(), secSet=new Set(), conSet=new Set();
  wrongIds.forEach(function(id){
    const q=App.idx.byId[id]; if(!q) return;
    if(q.kai!=null) kaiSet.add(q.kai);
    if(q.source&&q.source.section) secSet.add(q.source.section);
    (q.concepts||[]).forEach(function(c){ conSet.add(c); });
    (q.rubric||[]).forEach(function(rb){ if(rb.concept) conSet.add(rb.concept); });
  });
  Object.entries(App.progress.weakness||{}).sort(function(a,b){return b[1]-a[1];}).forEach(function(p){ conSet.add(p[0]); });
  const kais=Array.from(kaiSet).sort(function(a,b){return a-b;});
  const sections=Array.from(secSet).sort();
  const concepts=Array.from(conSet).slice(0,40);
  const sep='、';
  const subj=(App.course&&App.course.subject)?L(App.course.subject):L(App.course?App.course.title:{ja:'',zh:''});
  const lines=[ t('aiExpRole').replace('{subject}',subj), '', t('aiExpTask') ];  /* 学科名を直書きしていた(2門目で誤った役割) */
  if(wrongIds.length){
    lines.push('', t('aiExpMaterials'));
    if(kais.length) lines.push('・'+t('aiExpKaiLabel')+'：'+kais.join(sep));
    if(sections.length) lines.push('・'+t('aiExpSectionLabel')+'：'+sections.join(sep));
    if(concepts.length) lines.push('・'+t('aiExpConceptLabel')+'：'+concepts.join(sep));
    lines.push('', t('aiExpUse'));
  } else {
    lines.push('', t('aiExpClean'));
  }
  return { prompt:lines.join('\n'), materials:{ kais:kais, sections:sections, concepts:concepts } };
}
function doExport(includeRaw){
  const payload=buildExportV2(includeRaw); // v2＝全鍵同梱
  payload._説明 = tf('expNote',{c:L(App.course.title)})+(includeRaw?t('expNoteRaw'):t('expNoteNoRaw'));
  // AI 提示词 + 自动材料清单(随当前语言)。把这段连同数据一起喂给 AI 即可。
  const ai=buildExportAIPrompt();
  payload.aiPrompt=ai.prompt;
  payload.materials=ai.materials;
  payload.cardMarks=App.progress.cardMarks||{}; payload.hideLearned=!!App.progress.hideLearned; // serializeProgress は固定 schema で含まない → 進捗として同梱
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='quiz-progress_'+App.course.id+'_'+new Date().toISOString().slice(0,10)+'.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function impErrDialog(msg){ // 快审第十九批 K-17
  openModal(modalShell(t('impErrTitle'),[
    el('p',{class:'jp',style:'margin:0',text:msg}),
    el('div',{class:'row',style:'margin-top:14px'},[ el('button',{class:'btn',text:t('close'),onclick:closeModal}) ])
  ]));
}
function doImport(e){ if(!canWrite()) return; // 解析→検証→プレビュー確認→自動バックアップ付き適用
  const file=e.target.files[0]; if(!file) return;
  e.target.value='';
  if(importBlocked()){ alert(t('impRestoreFailed')); return; } // 前回の復元が途中で止まり、取り消しで安全に戻せる（照合が通る）：先に「取り消す」で戻してもらう。照合が通らないときは止めない（importBlocked：WLR2 必修 1）
  if(file.size>8*1024*1024){ alert(t('impSizeErr')); return; }
  const reader=new FileReader();
  reader.onload=function(){
    let obj, parsed; // U-35: 読めない・書き出しファイルでない、は引擎の生の文（中文・英語）を見せず、App の対話框で
    try{ obj=JSON.parse(reader.result); }catch(_){ impErrDialog(t('impNotJson')); return; }
    try{ parsed=C.deserializeProgress(obj); }catch(_){ impErrDialog(t('impNotExport')); return; }
    try{
    const ex=obj.extras||{};
    const n=function(k){ const v=EXTRA_NORM[k]?EXTRA_NORM[k](ex[k]):ex[k]; return Array.isArray(v)?v.length:(v&&typeof v==='object'?Object.keys(v).length:0); };
    const wrong=!importForThisCourse(obj); // B-057・X15-01：別の課のファイル・課程 ID が無効なファイルは四つの課とも取り込まない。中身は見せるが、取り込むボタンは出さず理由と（課程リストにある課なら）切り替え先だけ示す
    const warn=[];
    if(wrong) warn.push(wrongCourseText(parsed.courseId));
    else if(parsed.schemaVersion!==PROGRESS_SCHEMA) warn.push(t('impSchemaDiff'));
    const fn=t('fieldNames')||{}, rx=obj.rx&&typeof obj.rx==='object'?obj.rx:null;
    const rows=[
      t('impCourse')+': '+impCourseName(parsed.courseId),
      t('impDate')+': '+(obj.exportedAt?impLocalTime(obj.exportedAt):(obj.exportSchema>=2?'?':t('impV1')))
    ].concat(isRxCourse()&&rx?[ // 新課：学習状態は rx（復習の予定・演習の記録・試験日）にある。旧課の解答ずみ／間違いは常に 0 なので出さない
      fn.sched+': '+tf('itemCount',{n:Object.keys((rx.sched&&rx.sched.props)||{}).length}),
      t('impRxLog')+': '+tf('itemCount',{n:Array.isArray(rx.log)?rx.log.length:0}),
      fn.examDate+': '+(rx.examDate||'—')
    ]:[
      t('impSeen')+': '+Object.keys(parsed.progress.seen||{}).length+' / '+t('impWrong')+': '+Object.keys(parsed.progress.wrong||{}).length,
      t('impExtras')+': '+(obj.exportSchema>=2?tf('impExtrasCounts',{h:n('examHistory'),b:n('bookmarks'),r:n('readerBm')}):t('impExtrasNone'))
    ]);
    openModal(modalShell(t('impTitle'),[ // modalShell は null 子を受けない → filter(Boolean)
      el('div',{class:'jp'},rows.map(function(r){ return el('p',{class:'muted',style:'margin:4px 0',text:r}); })),
      warn.length?el('p',{class:'jp',style:'color:var(--no-deep);background:var(--no-wash);border:1px solid var(--no-line);border-radius:8px;padding:8px 10px',text:'⚠ '+warn.join(' / ')}):null,
      wrong?null:el('p',{class:'muted jp',style:'font-size:12px',text:t('impBackupNote')}),
      el('div',{class:'row',style:'margin-top:10px'},wrong?[ el('button',{class:'btn',text:t('close'),onclick:closeModal}) ]:[
        el('button',{class:'btn',text:t('impApply'),onclick:function(){
          try{ const sum=applyImportPayload(obj); try{ sessionStorage.setItem('quiz:impSkipped',JSON.stringify(sum.skipped||[])); if(sum.noUndo) sessionStorage.setItem('quiz:impNoUndo','1'); }catch(_){} closeModal(); dataReplaced(); location.reload(); }
          catch(err){
            if(err.ownershipLost){ closeModal(); return; } // 書き手を外れた：帯が知らせる
            if(err.restoreFailed){ closeModal(); alert(t(restoreFailKey(err))); return; }
            alert(err.plain?err.message:(t('impBadFile')+': '+err.message)); // plain＝そのまま見せる文（新課：戻せたので元のまま）
          }
        }}),
        el('button',{class:'btn ghost',text:t('impCancel'),onclick:closeModal})
      ])
    ].filter(Boolean)));
    }catch(err){ alert(t('impBadFile')+': '+err.message); }
  };
  reader.readAsText(file);
}
function askConfirm(title,text,okText,danger){ // 同期の confirm() の代わり（X13-01）：開いている間も主スレッドは空いているので、引き継ぎの頼み・札の更新を受け取れる。結果は Promise<boolean>
  return new Promise(function(res){ // danger＝消すなどの破壊的な確認：実行は赤い枠・既定にしない。「やめる」を主ボタンにして焦点もそこへ（S6 U-24）
    let done=false; const fin=function(v){ if(done) return; done=true; res(v); };
    const ok=el('button',{class:danger?'btn ghost btn-danger':'btn',id:'confirmOk',text:okText,onclick:function(){ fin(true); closeModal(); }});
    const no=el('button',{class:danger?'btn':'btn ghost',text:t('impCancel'),onclick:function(){ fin(false); closeModal(); }});
    openModal(modalShell(title,[
      el('p',{class:'jp',text:text}),
      el('div',{class:'row',style:'margin-top:10px'},danger?[no,ok]:[ok,no])
    ]));
    if(danger) setTimeout(function(){ try{ no.focus(); }catch(_){} },0);
    const root=document.getElementById('modalRoot'), m=root.firstElementChild;
    const obs=new MutationObserver(function(){ if(!m.isConnected || m.classList.contains('closing')){ obs.disconnect(); fin(false); } }); // ×・背景・Esc で閉じた＝いいえ
    obs.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  });
}
function afterConfirm(cleanup){ // 確かめたあと、一度タスクを譲ってから書き手を確かめ直す（同じタスクの中では、ほかのタブが書いた札がまだ見えない）。cleanup＝只删的整理入口でもよい（WLR1 WL-06）
  return new Promise(function(res){ setTimeout(function(){ res((cleanup && lockedForCleanup()) || holdsWriter()); },0); });
}
async function doResetProgress(){ if(!lockedForCleanup() && !canWrite()) return; // 二段リセットの軽い方＝学習進捗のみ。持锁で札だけ書けない（越えたあと）なら只删的整理として進む（WLR1 WL-06）
  if(!(await askConfirm(t('resetProg'),t(isRxCourse()?'resetProgConfirmRx':'resetProgConfirm'),t('resetProg'),true))) return;
  if(!(await afterConfirm(true))) return; // 確かめている間に書き手が移った：書かない（帯が知らせる）
  const cleanup=!writerOk, del=cleanup?lsDelLocked:lsDel;
  try{ const s0=App.session; App.session=null; App.readerReturn=null; if(s0){ s0.runningSince=0; clearCareTimer(); clearRunnerTimer(); } if(App.rxRun){ if(typeof rxClearTimer==='function') rxClearTimer(); App.rxRun=null; } }catch(e){} // 消す前に会話を終える（模試・新課の練習：WLR1 WL-04・合并裁定 一-3①）。pauseSessionClock は呼ばない：計時中だと persistExam で消したばかりの模試を書き戻していた（S2 指摘、952bbc5 の回退）
  del(nk('examInProgress')); del(nk('sched')); RX_KEYS.forEach(function(k){ del(nk(k)); }); del(nk('progress')); del(nk('importBackup')); delProgressBackups(del); // 持锁后先删再写（合成稿 v3.3：容量を超えていても、削除だけは通るので戻れる）。sched＝旧課の間隔復習（進捗の一部）。取り込みの退避も消す：記録を消したあとは照合が必ず通らず取り消しに使えないのに容量だけ占める（快審第三十五批 改訂稿 五・総指揮定）
  if(cleanup) becomeWriter(); // 消して空いた：同じ授锁のまま名乗り直す（札が書ければ書き手になり、進度は無い＝空から読み直す）
  progressBad=false; App.progress=emptyProgress(); if(writerOk) saveProgress(); pendingMigration=null; closeModal(); goHome(); // 導航栈も首页へ（goHome と同じ）：「戻る」で旧い練習画面に戻って押し直し、重置前の作答前の値で調度を書き戻さない（WLR1 合并裁定 一-3②） // 壊れて読めなかった進度もここで作り直す（五態の厳格な読みの出口）
}
async function doReset(){ if(!lockedForCleanup() && !canWrite()) return; // 重い方＝この課の端末内データ全消去（文案どおりに動く）。越えたあと札だけ書けないときも只删で進む（WLR1 WL-06）
  if(!(await askConfirm(t('reset'),t(isRxCourse()?'resetConfirmRx':'resetConfirm'),t('reset'),true))) return;
  if(!(await afterConfirm(true))) return; // 確かめている間に書き手が移った：消さない
  const del=writerOk?lsDel:lsDelLocked;
  COURSE_KEYS.forEach(function(k){ del(nk(k)); });
  del(nk('importBackup'));
  delProgressBackups(del);
  dataReplaced(); location.reload(); // 離页で記憶の進度を書き戻さない（全消去が戻っていた）
}
function oldProgressExport(raw){ // 迁移前的旧进度按标准导出外壳写出，才能经「ファイルを読み込む」导回（复原用，含手写答案）
  const ver=(raw&&raw.schemaVersion!=null)?raw.schemaVersion:0;
  const p=C.normalizeProgress(Object.assign(emptyProgress(),raw),ver);
  const out=C.serializeProgress(p,{courseId:App.course.id,schemaVersion:ver,appVersion:APP_VERSION},{includeRawAnswers:true});
  out.cardMarks=p.cardMarks; out.hideLearned=p.hideLearned;
  return out;
}
function showMigrationModal(){
  if(!pendingMigration) return;
  openModal(modalShell(t('migTitle'),[
    el('p',{class:'muted jp',text:t('migBody')}),
    el('div',{class:'row'},[
      el('button',{class:'btn',text:t('migExportOld'),onclick:function(){ const blob=new Blob([JSON.stringify(oldProgressExport(pendingMigration),null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='old-progress_'+App.course.id+'.json'; a.click(); }}),
      el('button',{class:'btn ghost',text:t('migContinue'),onclick:function(){ pendingMigration=null; saveProgress(); closeModal(); }})
    ])
  ]));
}
/* ===================== コース切替 =====================
 * 旧実装は「listrow に course.id を右端表示」するだけのモーダルで、現在どのコースに
 * 居るのかも、切替先に何があるのかも分からなかった。 */
function courseList(){ return (App.manifest&&App.manifest.courses)||[]; }
function courseStat(c){
  /* 課ごとの進捗は quiz:<id>:progress に隔離されている。切替前に「向こうの状況」を出すため、
   * 課を読み込まずに localStorage だけ覗く(軽い)。 */
  let seen=0;
  try{ const p=JSON.parse(localStorage.getItem('quiz:'+c.id+':progress')||'null'); if(p&&p.seen) seen=Object.keys(p.seen).length; }catch(e){}
  const total=(c.exam&&c.exam.total)||0;
  const cur=App.course&&App.course.id===c.id;
  if(c.contract===RX.CONTRACT){ // 新課：「今日の復習」の件数。実際の復習の列（RX.dueQueue）と同じ規則で、その課のいまの命題だけを数える（X12-01：退役した命題を数えない）
    const ix=rxIndexOf(c.id);
    if(!ix) return {seen:0, total:0, cur:cur, due:0, line:''}; // 索引がまだ無い（背景で取得中・取れない）ときは件数を出さない。届いたら行を差し替える
    let due=0;
    try{ due=RX.dueQueue(ix,JSON.parse(localStorage.getItem('quiz:'+c.id+':rx:sched')||'null'),RX.dayIndex(new Date()),{}).list.length; }catch(e){}
    return {seen:0, total:0, cur:cur, due:due, line:due?(t('rxReviewToday')+'　'+tf('rxReviewN',{n:due})):t('rxReviewNone')};
  }
  const out={seen:seen, total:total, cur:cur,
    line:(c.shape==='reader')?tf('csReader',{n:total}):tf('csExam',{n:total,m:seen})};
  if(c.features && c.features.spaced===true){ // 旧課の間隔復習（S1-d）：件数は今日の復習の列と同じ規則（spCourseDue）。題集の ID がまだ無ければ出さず、届いたら行を差し替える
    const due=spCourseDue(c);
    if(due!==null){ out.due=due; out.line2=due?(t('rxReviewToday')+'　'+tf('rxReviewN',{n:due})):t('rxReviewNone'); }
  }
  return out;
}
/* コース切替の専用転場。行き先の課の肌色でヴェールを敷き、その下で loadCourse し、
 * ヴェールが引くのと同時に新ホームが立ち上がる。after は「切替と同時に行き先まで」用。 */
async function enterCourse(c, after){
  closeModal();
  const same = App.course && App.course.id===c.id;
  if(same){ if(after) after(); return; }
  if(courseSwapping) return; // 切替の途中で重ねて切り替えない
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sk=c.skin||{}, dk=(typeof themeDark==='function' && themeDark() && typeof darkPalette==='function')?darkPalette(sk):null; // 深色のときは行き先の課の深色で覆う（浅色の面が一瞬光らない：U-43／U-72）
  const pal=dk?{'--accent-wash':dk['--accent-wash'],'--paper':dk['--paper'],'--card2':dk['--card2'],'--soft':dk['--soft'],'--accent':dk['--accent']}:sk;
  const veil=el('div',{class:'course-veil',role:'status','aria-live':'polite'},[ el('div',{class:'cv-in'},[ el('div',{class:'cv-t jp',text:tf('cvLoading',{c:L(c.title)||''})}), el('div',{class:'cv-bar','aria-hidden':'true'},[ el('i') ]) ]) ]); // 何が起きているか（U-72：中身のない色の面だった）
  veil.style.setProperty('--cv-accent',(pal['--accent-wash']||pal['--accent']||'var(--accent-wash)'));
  veil.style.setProperty('--cv-wash',(pal['--accent-wash']||'var(--accent-wash)'));
  veil.style.setProperty('--cv-paper',(pal['--paper']||'var(--paper)'));
  veil.style.setProperty('--cv-card',(pal['--card2']||pal['--paper']||'var(--card)'));
  veil.style.setProperty('--cv-ink',dk?dk['--soft']:(sk['--accent-ink']||sk['--soft']||'var(--soft)')); // 文字は行き先の課の色（今の課の色が残らない）
  veil.style.setProperty('--cv-bar',(pal['--accent']||'var(--accent)'));
  document.body.appendChild(veil);
  courseSwapping=true;
  const dropVeil=function(){                 // ヴェールは何があっても必ず剥がす(取りこぼすと全画面が固まる)
    if(reduce){ try{ veil.remove(); }catch(_){} return; }
    veil.classList.remove('in'); veil.classList.add('out');
    const done=function(){ try{ veil.remove(); }catch(_){} };
    veil.addEventListener('animationend',done); setTimeout(done,520);
  };
  try{
    if(!reduce){ veil.classList.add('in'); await new Promise(function(r){ setTimeout(r,200); }); }
    const okLoad=await loadCourse(c);
    if(okLoad && after) after();             // 読み込み失敗(エラー画面表示)時は行き先へ進めない。エラーを潰さない
  }catch(e){
    try{ console.error('enterCourse',e); }catch(_){}
  }finally{
    courseSwapping=false;
    dropVeil();                              // try/finally の中で剥がす → 途中で例外が飛んでもヴェールは残らない
  }
}
async function switchTo(c){ await enterCourse(c); }

/* 課の切替に全画面シートは重い(たかが 2 コースの行き来)。topbar 直下の小さな浮きに統一する。 */
function closeCoursePop(restoreFocus){ const o=document.getElementById('cpop'); if(o) o.remove(); const cb=document.getElementById('courseBtn'); if(cb){ cb.setAttribute('aria-expanded','false'); if(restoreFocus) cb.focus(); } } // 閉路は全てここに集約=aria-expanded の戻し忘れなし。Escape 閉路は焦点を釦へ返す
function placeUnder(pop,btn){ // 浮きを呼び出したボタンの真下・右端揃えに（画面からはみ出さない）。開いているあいだは窓の大きさに追従（U-81）
  if(!btn) return;
  const place=function(){ if(!document.body.contains(pop)){ window.removeEventListener('resize',place); return; }
    const r=btn.getBoundingClientRect(); if(!r.width) return; const vw=document.documentElement.clientWidth, w=pop.offsetWidth;
    let right=Math.max(8,Math.round(vw-r.right)); if(vw-right-w<8) right=Math.max(8,vw-w-8);
    pop.style.top=Math.round(r.bottom+6)+'px'; pop.style.right=right+'px'; };
  place(); window.addEventListener('resize',place);
}
/* 全画面の図版ビューア（S6 U-14・U-46）：スライド・レジュメ原頁・原創 SVG を画面いっぱいに。5 段の拡大、はみ出した分はスクロール／ドラッグで移動、
 * ダブルクリックで 2 段目と全体を往復、+／−／0（⌘± も）、Esc で閉じて押したボタンへ焦点を返す。読み込み中は骨組みを出す。 */
let viewerOff=null;
function openViewer(o){ // o:{src,w,h,svg,alt,title,cap}
  closeViewer();
  const back=returnTarget(), steps=[1,1.5,2,3,4]; let si=0, natW=o.w||0, natH=o.h||0;
  const media=o.svg||el('img',{src:o.src,alt:o.alt||'',decoding:'async'});
  if(o.svg){ const vb=o.svg.viewBox&&o.svg.viewBox.baseVal; natW=(vb&&vb.width)||parseFloat(o.svg.getAttribute('width'))||800; natH=(vb&&vb.height)||parseFloat(o.svg.getAttribute('height'))||600;
    o.svg.removeAttribute('width'); o.svg.removeAttribute('height'); }
  const content=el('div',{class:'vw-content'+(o.svg?' vw-svg':'')},[ media ]);
  const stage=el('div',{class:'vw-stage'+(o.svg?'':' loading')},[ content ]);
  const b=function(label,icon,fn){ return el('button',{class:'vw-b','aria-label':label,title:label,html:NEW_ICONS[icon],onclick:fn}); };
  const zout=b(t('figZoomOut'),'minus',function(){ set(si-1); }), zin=b(t('figZoom'),'plus',function(){ set(si+1); }), fit=b(t('figFit'),'fit',function(){ set(0); }), cls=b(t('close'),'close',closeViewer);
  const root=el('div',{class:'vw',id:'viewer',role:'dialog','aria-modal':'true','aria-label':o.title||o.alt||t('figTitle')},[
    el('div',{class:'vw-bar'},[ el('div',{class:'vw-t jp',text:o.title||o.alt||''}), zout, zin, fit, cls ]), stage,
    o.cap?el('div',{class:'vw-cap jp',text:o.cap}):null ].filter(Boolean));
  const fitScale=function(){ if(!natW||!natH) return 1; return Math.min((stage.clientWidth-32)/natW,(stage.clientHeight-32)/natH); };
  const apply=function(){ const f=fitScale()*steps[si]; content.style.width=Math.round(natW*f)+'px'; content.style.height=Math.round(natH*f)+'px';
    zin.disabled=si>=steps.length-1; zout.disabled=si<=0; fit.disabled=si<=0; stage.classList.toggle('zoomed',si>0); };
  function set(i,cx,cy){ const prev=steps[si]; si=Math.max(0,Math.min(steps.length-1,i)); const r=stage.getBoundingClientRect();
    const px=cx==null?r.width/2:cx-r.left, py=cy==null?r.height/2:cy-r.top, ax=(stage.scrollLeft+px)/prev, ay=(stage.scrollTop+py)/prev;
    apply(); stage.scrollLeft=ax*steps[si]-px; stage.scrollTop=ay*steps[si]-py; } // 指した所（なければ中央）を中心に拡大
  if(!o.svg){ media.addEventListener('load',function(){ natW=media.naturalWidth||natW; natH=media.naturalHeight||natH; stage.classList.remove('loading'); apply(); });
    media.addEventListener('error',function(){ stage.classList.remove('loading'); }); }
  stage.addEventListener('dblclick',function(e){ set(si>0?0:2,e.clientX,e.clientY); });
  let drag=null; // マウスでつかんで動かす（指はブラウザの既定のスクロール）
  stage.addEventListener('pointerdown',function(e){ if(e.pointerType!=='mouse'||si===0) return; drag={x:e.clientX,y:e.clientY,l:stage.scrollLeft,t:stage.scrollTop}; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove',function(e){ if(!drag) return; stage.scrollLeft=drag.l-(e.clientX-drag.x); stage.scrollTop=drag.t-(e.clientY-drag.y); });
  stage.addEventListener('pointerup',function(){ drag=null; });
  stage.setAttribute('tabindex','-1'); // 図を押したあとも焦点を看图器の中に留める（押した所は焦点を持たない＝body に落ちて Esc が届かなかった：Codex 复查 N-01）
  stage.addEventListener('pointerdown',function(){ if(!root.contains(document.activeElement)) try{ stage.focus({preventScroll:true}); }catch(_){} });
  const onKey=function(e){ // 開いている間は文書全体でキーを受ける（焦点がどこにあっても Esc で閉じる・＋／−／0）。捕获段で止め、下の画面や弹窗に渡さない
    if(!document.getElementById('viewer')) return;
    if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); closeViewer(); return; }
    if(e.metaKey||e.ctrlKey||e.altKey){ if(e.key==='+'||e.key==='='||e.key==='-'||e.key==='0'){ e.preventDefault(); e.stopPropagation(); set(e.key==='0'?0:(e.key==='-'?si-1:si+1)); } return; }
    if(e.key==='+'||e.key==='='){ e.preventDefault(); e.stopPropagation(); set(si+1); } else if(e.key==='-'||e.key==='_'){ e.preventDefault(); e.stopPropagation(); set(si-1); } else if(e.key==='0'){ e.preventDefault(); e.stopPropagation(); set(0); }
  };
  document.addEventListener('keydown',onKey,true);
  document.body.appendChild(root); setBackdropInert(true,[root]); trapFocus(root);
  const onResize=function(){ apply(); }; window.addEventListener('resize',onResize);
  viewerOff=function(){ document.removeEventListener('keydown',onKey,true); window.removeEventListener('resize',onResize); setBackdropInert(false); if(back&&document.body.contains(back)){ try{ back.focus(); }catch(_){} } };
  apply(); cls.focus();
}
function closeViewer(){ const r=document.getElementById('viewer'); if(!r) return; r.remove(); const f=viewerOff; viewerOff=null; if(f) f(); }
function closeTbMenu(back){ const m=document.getElementById('tbMenu'); if(m) m.remove(); const b=document.getElementById('moreBtn'); if(b){ b.setAttribute('aria-expanded','false'); if(back) b.focus(); } }
function openTbMenu(){
  if(document.getElementById('tbMenu')){ closeTbMenu(true); return; }
  closeCoursePop();
  const item=function(label,fn,lang,pressed){ return el('button',{class:'tbm-i jp',lang:lang||null,'aria-pressed':pressed==null?null:String(pressed),onclick:function(){ closeTbMenu(false); fn(); }},[ label ]); };
  const m=el('div',{class:'tbmenu',id:'tbMenu',role:'dialog','aria-label':t('tbMore')},[
    item(t('helpTitle'),openHelp), item(t('setTitle'),openSettings), el('div',{class:'tbm-sep','aria-hidden':'true'}),
    item(t('langNameJa'),function(){ setLang('ja'); },'ja',App.lang==='ja'), item(t('langNameZh'),function(){ setLang('zh'); },'zh-CN',App.lang==='zh') ]);
  document.body.appendChild(m);
  const b=document.getElementById('moreBtn'); if(b) b.setAttribute('aria-expanded','true');
  placeUnder(m,b); trapFocus(m);
  m.addEventListener('keydown',function(e){
    if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); closeTbMenu(true); return; }
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){ const f=[].slice.call(m.querySelectorAll('.tbm-i')); let i=f.indexOf(document.activeElement); i=(e.key==='ArrowDown')?(i+1)%f.length:(i-1+f.length)%f.length; f[i].focus(); e.preventDefault(); }
  });
  const first=m.querySelector('.tbm-i'); if(first) first.focus();
  setTimeout(function(){ document.addEventListener('click',function h(e){ // 外側のクリックは閉じるだけ（下の控件に通さない）
    if(!m.isConnected){ document.removeEventListener('click',h,true); return; } // 自分のメニューだけを見る（項目で閉じたあとに開いた次のメニューを巻き込まない）
    if(!m.contains(e.target) && !e.target.closest('#moreBtn')){ e.preventDefault(); e.stopPropagation(); closeTbMenu(false); document.removeEventListener('click',h,true); }
  },true); },0);
}
function openCoursePop(kids,cls){
  closeCoursePop(); closeTbMenu(false);
  const pop=el('div',{class:'cpop '+(cls||''),id:'cpop',role:'dialog','aria-label':t('coursePop')},kids);
  document.body.appendChild(pop);
  placeUnder(pop,document.getElementById('courseBtn'));
  const cb=document.getElementById('courseBtn'); if(cb) cb.setAttribute('aria-expanded','true'); // 開閉状態を晒す (aria-controls=cpop は静的標記側)
  trapFocus(pop); // Tab/Shift+Tab は浮き内で循環
  pop.addEventListener('keydown',function(e){ // Escape=閉じて呼び出し元へ・↑↓=項目間移動
    if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); closeCoursePop(true); return; }
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      const f=Array.prototype.filter.call(pop.querySelectorAll(FOCUSABLE),function(x){ return x.offsetParent!==null; });
      if(!f.length) return;
      let i=f.indexOf(document.activeElement);
      i=(e.key==='ArrowDown')?(i+1)%f.length:(i-1+f.length)%f.length;
      f[i].focus(); e.preventDefault();
    }
  });
  const first=pop.querySelector(FOCUSABLE); if(first) first.focus();
  setTimeout(function(){
    document.addEventListener('click',function h(e){ // 捕获段で受けて外側のクリックを飲み込む：閉じるだけで、下の控件（試験をはじめる等）を押さない
      if(!pop.isConnected){ document.removeEventListener('click',h,true); return; } // 自分の浮きだけを見る（中のボタンで閉じたあと、次に開いた浮きの中のクリックを飲まない）
      if(!pop.contains(e.target) && !e.target.closest('#courseBtn')){ e.preventDefault(); e.stopPropagation(); closeCoursePop(); document.removeEventListener('click',h,true); }
    },true);
  },0);
  return pop;
}
/* topbar 直下の浮き。切替と同時に「向こうで何をするか」まで選べるので、行き先が決まっていれば 1 手で着く。 */
function openCourseSwitch(){
  if(document.getElementById('cpop')){ closeCoursePop(); return; }
  openCoursePop(courseMenuRows(),'wide');
  spPrefetchIds(); // 旧課の件数には題 ID が要る（S1-d）
  rxPrefetchOthers(); // 新課の件数には索引が要る：まだ取っていない課は背景で取り、届いたら該当の行だけ差し替える（rxCourseRowRefresh）
}
function rxCourseRowRefresh(cid){ // 背景取得が届いたとき、開いている切替の浮きの該当行だけ作り直す（焦点はその行の同じボタンへ戻す）
  const old=document.querySelector('#cpop .cm-i[data-cid="'+cid+'"]'), c=courseList().find(function(x){ return x.id===cid; });
  if(!old || !c) return;
  const had=old.contains(document.activeElement), row=courseMenuRow(c);
  old.replaceWith(row);
  if(had){ const b=row.querySelector('.cm-main'); if(b) b.focus(); }
}
function courseMenuRows(){ return courseList().map(courseMenuRow); }
function courseMenuRow(c){
  const st=courseStat(c);
  const row=el('div',{class:'cm-i'+(st.cur?' on':''),'data-cid':c.id},[
    el('button',{class:'cm-main',onclick:function(){ closeCoursePop(); switchTo(c); }},[
      el('span',{class:'cm-dot',style:'background:'+((c.skin&&c.skin['--accent'])||'var(--accent)')}),
      el('span',{class:'cm-tx'},[ el('b',{class:'jp',text:L(c.title)}), st.line?el('small',{class:'jp',text:st.line}):null, st.line2?el('small',{class:'jp',text:st.line2}):null ].filter(Boolean)),
      st.cur?el('span',{class:'cm-ck',text:'✓'}):el('span',{class:'cm-ck',text:'›'})
    ])
  ]);
  const acts=el('div',{class:'cm-acts'});
  const go=function(fn,write){ return async function(){ // write＝書く操作（模試・復習）。切課直後は書き手が決まってから始める（S4-014：決まる前だと canWrite() で黙って止まっていた）
    closeCoursePop();
    if(st.cur){ fn(); return; }
    let loaded=false;
    await enterCourse(c,function(){ loaded=true; if(!write) fn(); });
    if(!write || !loaded) return;
    const gen=navGen;
    await whenWriter(HANDOFF_GRACE+2000); // ほかのタブが書き手のままなら時間切れ：そのまま始めて canWrite() の帯（B-007 の案内）を出す
    if(navGen===gen && App.course && App.course.id===c.id) fn(); // 待つ間に一度でも画面を移ったら（戻ってきても）何もしない（X12b-01：導航代次で判定）
  }; };
  if(c.contract===RX.CONTRACT){
    if(st.due) acts.appendChild(el('button',{class:'cm-a jp',text:t('rxReviewToday'),onclick:go(function(){ rxReviewRun(); },true)}));
    acts.appendChild(el('button',{class:'cm-a jp',text:t('cmSearch'),onclick:go(function(){ rxSearchOpen(''); })})); // 新課の検索（Q-026）
  }else if(c.shape==='reader'){
    if(st.due) acts.appendChild(el('button',{class:'cm-a jp',text:t('rxReviewToday'),onclick:go(function(){ spReviewRun(); },true)})); // 旧課の間隔復習（S1-d）
    acts.appendChild(el('button',{class:'cm-a jp',text:t('cmSearch'),onclick:go(function(){ renderSearch(''); })}));
    acts.appendChild(el('button',{class:'cm-a jp',text:t('cmRead'),onclick:go(function(){ readerDir='fwd'; const lr=lsGet(nk('lastRead'),null); if(lr) resumeReader(lr); else renderReader(1,0); })}));
  }else{
    if(st.due) acts.appendChild(el('button',{class:'cm-a jp',text:t('rxReviewToday'),onclick:go(function(){ spReviewRun(); },true)})); // 旧課の間隔復習（S1-d）
    acts.appendChild(el('button',{class:'cm-a jp',text:t('cmExam'),onclick:go(function(){ startExam(); },true)}));
    acts.appendChild(el('button',{class:'cm-a jp',text:t('cmNote'),onclick:go(function(){ renderReaderIndex(); })}));
  }
  row.appendChild(acts);
  return row;
}

function copyText(text,btn){
  function ok(){ if(btn){ const o=btn.textContent; btn.textContent=t('copied'); setTimeout(()=>btn.textContent=o,1400); } }
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(ok,()=>fallback()); } else fallback();
  function fallback(){ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');ok();}catch(e){} ta.remove(); }
}


/* ===================================================================
 * 功能模块（dashboard / countdown / 回map /
 * stats / flashcards / search / bookmarks / settings / care timer / viz）
 * 全部纯前端、localStorage、不碰 questions/concepts 内容、题型注册表分发。
 * =================================================================== */

/* ---------- course-specific presentation config ----------
 * 回タイトル・章立ては course-manifest 駆動へ。
 * 旧版は KAI_TITLES / CHAPTERS を裸の回番号でキーにしたモジュール定数に持っていた。
 * 2 門目(神経)を足すと第1回が「臨床心理学とは」と表示される——エラーではなく
 * "それらしい誤り" が黙って出るので、最もたちが悪い。manifest に無い課は null に落として
 * manual の unit タイトルで補う(表示専用。判定には一切影響しない)。 */
function courseKaiTitles(){ return (App.course&&App.course.kaiTitles)||{}; }
function CHAPTERS_OF(){ return (App.course&&App.course.chapters)||[]; }
function kaiTitle(kai){ const o=courseKaiTitles()[String(kai)]; if(o) return L(o);
  if(App.manual&&App.manual.units){ const u=App.manual.units.find(function(x){ return x.kai===kai; }); if(u) return u.subtitle||u.title; }
  return null; }
/* 到達度: 回ごとの topic 副題(manual unit の sections/lede 由来; canonical 只读、纯呈现) */
function kaiTopic(kai){ if(!(App.manual&&App.manual.units)) return null;
  const u=App.manual.units.find(function(x){ return x.kai===kai; }); if(!u) return null;
  const tt=kaiTitle(kai);
  if(u.sections&&u.sections.length){ const picks=u.sections.map(function(s){ return s.title; }).filter(function(x){ return x&&x!==tt; }).slice(0,2); if(picks.length) return picks.join('・'); }
  return u.lede? (u.lede.length>44?u.lede.slice(0,42)+'…':u.lede) : null; }
/* 到達度: 章分组的回数区间标签(第a-b回) */
function kaiRangeLabel(kais){ if(!kais||!kais.length) return ''; const a=kais[0], b=kais[kais.length-1]; return a===b?tf('kaiN',{n:a}):tf('kaiRange',{a:a,b:b}); }

function getHand(){ return lsGet('quiz:hand','right'); }
/* 只読のタブ（U-25・画面の層だけ）：書く操作を押したら説明と「こちらで続ける」。保存の故障（帯に接管ボタンが無い状態）では出さない */
let roNoticeAt=0;
function roNotice(){
  if(typeof updateGateOn!=='undefined' && updateGateOn){ showUpdateGate(false); return; } // 確認門がまだ：只読の説明ではなく門を出す（三-8）
  if(document.querySelector('#modalRoot [data-recovery]')){ pulseWriterBanner(); return; } // 恢復框（保存できなかった下書きの复制）を説明で置き換えない（CR-32）
  if(storageBroken || lockRetrying || (!document.getElementById('writerBanner') && !writerWas)) return; // 再読み込み直後の帯が出る前の一瞬は出さない（交接で書き手を失った直後は帯を待たない：CR-01）
  const ev=window.event; // 利用者の操作（本物のクリック・キー）の最中だけ出す。canWrite() は確認だけにも使われ、脚本からの問い合わせで対話框を開くとそのタブの後続の操作を塞ぐ（s1c C9）
  if(!((ev && ev.isTrusted) || window.__rxKeyGesture)) return; // 新課のキー操作はボタンを脚本で押すので印で見分ける
  if(document.querySelector('#modalRoot .ro-notice') || Date.now()-roNoticeAt<600) return; roNoticeAt=Date.now();
  openModal(modalShell(t('writerRoTitle'),[ el('p',{class:'jp ro-notice',text:t('writerLocked')}),
    el('div',{class:'row',style:'margin-top:14px;gap:10px'},[ el('button',{class:'btn',text:t('writerTakeOver'),onclick:function(){ closeModal(); takeOverWriter(); }}),
      el('button',{class:'btn ghost',text:t('close'),onclick:closeModal}) ]) ]),[ document.getElementById('writerBanner') ]); // 帯の「こちらで続ける」も押せるまま（説明は帯を塞がない）
  document.body.classList.add('ro-notice-open');
}
/* 新課の練法：只読の間は作答の操作をここで止めて説明を出す（記録だけが黙って捨てられ、正誤は出ていた）。
 * 判定は書き権限だけに従う：遅れて付く writer-ro 類を待つと、交接直後の約 400ms に作答がすり抜けていた（CR-01）。各練法の判分も直前に canWrite を見る */
document.addEventListener('click',function(e){
  if(writerOk) return;
  const b=e.target && e.target.closest && e.target.closest('.rx-run-b button:not(.rx-tri-go):not(.rx-fb-h)'); if(!b) return; // 読むだけの操作（カードを見る・各肢の解説を開く）は止めない（CR-05）
  e.preventDefault(); e.stopPropagation(); canWrite();
},true);
function setHand(h){ lsSet('quiz:hand',h); }
function setThemePref(v){ lsSet('quiz:theme',v); if(App.course) applySkin(App.course); } // 画面の色（U-43）：端末ごと・四課共通。applySkin が深色の値を付け外しする
function getExamDate(){ return lsGet(nk('examDate'),null); }
function setExamDate(v){ if(!canWrite()) return false; const ok=v?lsSet(nk('examDate'),v):lsDel(nk('examDate')); if(!ok) return false; if(currentView===renderHome){ renderHome(); } return true; } // 戻り値＝保存できたか（CR-15：失敗でも閉じていた）。// 設定後に即再描画(以前はリロードしないとカウントダウンが出ない bug)
function daysUntilExam(){ const d=getExamDate(); if(!d) return null; const today=new Date(); today.setHours(0,0,0,0); const ex=new Date(d+'T00:00:00'); if(isNaN(ex)) return null; return Math.round((ex-today)/86400000); }
/* 首页の「試験まで あと N 日・…1日 N問が目安です。」：一つの行内要素にまとめ（.greetsub は flex なので、文の切れ目ごとに別の項目になり数字の前後で折れていた）、
 * 「あと N 日」と数字＋前後の語は折らない（文言は変えず、折り目だけ） */
function examSubHtml(left,pace){
  const bind=function(s,n){ return s.replace(/(\S{0,2})(\s?)\{n\}(\s?)(\S?)/,function(m,a,s1,s2,b){ return '<span class="nw">'+a+s1+'<b>'+n+'</b>'+s2+b+'</span>'; }); };
  return '<span class="gs-t"><span class="nw">'+t('examIn').replace('{n}','<b>'+left+'</b>')+'</span>'+(pace?(t('paceSep')+bind(t('pace'),pace)):'')+'</span>';
}
function suggestedPace(){ const left=daysUntilExam(); if(left==null||left<=0) return null; const total=App.questions.length; const seen=Object.keys(App.progress.seen||{}).length; const remain=Math.max(0,total-seen); return remain>0?Math.ceil(remain/left):0; }

/* ---------- bookmarks（书签题，存本机；星标在解说层切换） ---------- */
function getBookmarks(){ return lsGet(nk('bookmarks'),{}); }
function isBookmarked(id){ return !!getBookmarks()[id]; }
function toggleBookmark(id){ if(!canWrite()) return isBookmarked(id); const r=lsRead5(nk('bookmarks'),lsObj); if(r.st!=='none' && r.st!=='ok'){ dataBad(nk('bookmarks')); return isBookmarked(id); } const b=r.v||{}; if(b[id]) delete b[id]; else b[id]=true; if(!lsSet(nk('bookmarks'),b)) return isBookmarked(id); return !!b[id]; } // 書けたときだけ新しい状態を返す（書けなければ元のまま：帯が知らせ、押し直せる。WLR1 WL-05） // 読めない・壊れた印は上書きしない（五態の厳格な読み）
/* ---------- 模試結果の履歴（保存＋回看; 追加キー examHistory, PROGRESS 契約は不変更） ---------- */
function getExamHistory(){ return lsGet(nk('examHistory'),[]); }
function saveExamHistory(sess,agg){ // 戻り値＝書けたか。書けなければ黙って捨てない（総指揮裁定：未保存の帯）
  try{
    const answered=sess.list.length, correct=agg.totals.correct;
    const unc=sess.list.filter(function(q){ const st=sess.perItem[q.id]; return st&&st.uncertain; }).length;
    const k=nk('examHistory'), r=lsRead5(k,Array.isArray); if(r.st!=='none' && r.st!=='ok') return dataBad(k); // 読めない・壊れている：空とみなして旧い結果を消さない（CR-31・五態の厳格な読み）
    const h=r.v||[];
    h.unshift({ at:Date.now(), total:sess.list.length, answered:answered, correct:correct,
      pct:answered?Math.round(correct/answered*100):0,
      wrongIds:(agg.wrongIds||[]).slice(0,200), unc:unc, ms:examElapsed() });
    if(h.length>60) h.length=60; // 上限: 期末運用に十分・localStorage を太らせない
    return lsSet(k,h);
  }catch(e){ noteSave(nk('examHistory'),false); return false; }
}
function fmtHistDate(at,full){ const d=new Date(at);
  const hm=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  return (full?(d.getFullYear()+'/'):'')+(d.getMonth()+1)+'/'+d.getDate()+' '+hm;
}
function renderExamHistory(){
  registerFrame(renderExamHistory,'examhist');
  const kids=[ el('div',{class:'sechd'},[ el('button',{class:'back jp',html:'‹ '+t('home'),onclick:exitToHome}), el('h2',{class:'jp',text:t('histTitle')}) ]) ];
  kids.push(el('p',{class:'muted jp',style:'margin:0 0 12px',text:t('histSub')}));
  const h=getExamHistory();
  if(!h.length){ kids.push(el('div',{class:'card jp'},[ kaoWrap(t('histEmpty')) ])); }
  else h.forEach(function(e,i){
    kids.push(el('button',{class:'listrow',onclick:function(){ renderExamHistDetail(i); }},[
      el('span',{class:'lead',text:e.pct+'%'}),
      el('span',{class:'main jp'},[ document.createTextNode(t('modeExam')+'・'+e.total+t('q')),
        el('small',{text:fmtHistDate(e.at)+'・'+t('histWrongN').replace('{n}',String(e.wrongIds.length))+(e.unc?('・'+t('histUnc').replace('{n}',String(e.unc))):'')}) ]),
      el('span',{class:'cnt',text:fmtDuration(e.ms/1000)})
    ]));
  });
  setView(el('div',null,kids));
}
function renderExamHistDetail(i){
  const e=getExamHistory()[i]; if(!e) return renderExamHistory();
  registerFrame(function(){ renderExamHistDetail(i); },'examhistd');
  const kids=[ el('div',{class:'sechd'},[ el('button',{class:'back jp',html:'‹ '+t('histTitle'),onclick:renderExamHistory}), el('h2',{class:'jp',text:t('modeExam')+'・'+fmtHistDate(e.at,true)}) ]) ];
  const card=el('div',{class:'card'});
  card.appendChild(el('div',{class:'bigscore'},[ el('span',{class:'pct',text:e.pct+'%'}), el('span',{class:'frac',text:e.correct+' / '+e.answered+'  '+t('score')}) ]));
  card.appendChild(el('div',{class:'statgrid'},[ statBox(e.answered,t('histAnswered')), statBox(e.correct,t('correct')), statBox(e.wrongIds.length,t('wrong')) ]));
  card.appendChild(el('div',{class:'examtime jp',text:t('examTime')+'　'+fmtDuration(e.ms/1000)}));
  if(e.wrongIds.length){
    card.appendChild(el('div',{class:'rubt jp',style:'margin-top:12px',text:t('subWrong')}));
    e.wrongIds.forEach(function(id){ const q=App.idx.byId[id]; if(!q) return;
      card.appendChild(el('button',{class:'listrow',onclick:function(){ startPracticeIds([id]); }},[
        el('span',{class:'lead',text:tf('kaiTag',{n:q.kai})}),
        el('span',{class:'main jp',text:(q.q||'').slice(0,46)+((q.q||'').length>46?'…':'')})
      ]));
    });
    card.appendChild(el('button',{class:'btn',style:'margin-top:12px',text:t('histRedo'),onclick:function(){ startPracticeIds(e.wrongIds.slice()); }}));
  } else {
    card.appendChild(el('div',{class:'jp',style:'margin-top:12px'},[ kaoWrap(t('histNoWrong')) ]));
  }
  kids.push(card);
  setView(el('div',null,kids));
}

/* ---------- derived stats（全部由 attempts/seen 派生，无后端） ---------- */
function latestAttempts(){ const last={}; (App.progress.attempts||[]).forEach(function(a){ last[a.id]=a; }); return last; }
function progressKaiStats(){
  const out={}, last=latestAttempts();
  App.idx.kais.forEach(function(k){
    const ids=App.idx.kaiToQuestions[k]||[]; let seen=0; ids.forEach(function(id){ if(App.progress.seen[id]) seen++; });
    out[k]={total:ids.length,seen:seen,cov:ids.length?seen/ids.length:0,answered:0,correct:0,acc:null};
  });
  Object.keys(last).forEach(function(id){ const q=App.idx.byId[id]; if(!q||q.kai==null||!out[q.kai]) return; out[q.kai].answered++; if(last[id].correct===true) out[q.kai].correct++; });
  App.idx.kais.forEach(function(k){ out[k].acc=out[k].answered?out[k].correct/out[k].answered:null; });
  return out;
}
function chapterStats(){
  const ks=progressKaiStats(), rows=[], used={};
  CHAPTERS_OF().forEach(function(ch){ let a=0,c=0,any=false; ch.kais.forEach(function(k){ if(ks[k]){ a+=ks[k].answered; c+=ks[k].correct; used[k]=1; if(ks[k].total>0) any=true; } }); if(any) rows.push({label:L(ch),answered:a,correct:c,acc:a?c/a:null}); });
  const left=App.idx.kais.filter(function(k){ return !used[k]; });
  if(left.length){ let a=0,c=0; left.forEach(function(k){ a+=ks[k].answered; c+=ks[k].correct; }); rows.push({label:t('groupOther'),answered:a,correct:c,acc:a?c/a:null}); }
  return rows;
}
function weekActivity(){
  const days=[], now=new Date(); now.setHours(0,0,0,0);
  for(let i=6;i>=0;i--){ const d=new Date(now); d.setDate(d.getDate()-i); days.push({start:d.getTime(),n:0}); }
  (App.progress.attempts||[]).forEach(function(a){ const tt=a.at||0; for(let i=0;i<7;i++){ if(tt>=days[i].start && tt<days[i].start+86400000){ days[i].n++; break; } } });
  return {days:days,total:days.reduce(function(s,d){return s+d.n;},0)};
}
function conceptStat(c){
  const ids=App.idx.conceptToQuestions[c]||[], idset={}; ids.forEach(function(id){ idset[id]=1; });
  const last=latestAttempts(); let ans=0,wrong=0;
  Object.keys(last).forEach(function(id){ if(idset[id]){ ans++; if(last[id].correct!==true) wrong++; } });
  return {answered:ans,wrong:wrong,rate:ans?wrong/ans:0};
}

function svgNode(s){ return el('span',{class:'svgwrap',html:s}); }
function ringSVG(pct,opt){
  opt=opt||{}; const sz=opt.sz||78,r=opt.r||31,sw=opt.sw||9,c=sz/2,circ=2*Math.PI*r;
  const p=Math.max(0,Math.min(1,pct||0)), dash=circ*p;
  const center=opt.center!=null?opt.center:(Math.round(p*100)+'<tspan font-size="'+Math.round((opt.big||19)*0.58)+'">%</tspan>');
  const sub=opt.sub?('<text x="'+c+'" y="'+(c+14)+'" text-anchor="middle" font-size="9.5" fill="var(--soft)">'+opt.sub+'</text>'):'';
  const cy=opt.sub?(c-1):(c+ (opt.big||19)*0.33);
  return '<svg viewBox="0 0 '+sz+' '+sz+'" width="'+sz+'" height="'+sz+'">'+
    '<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="var(--line)" stroke-width="'+sw+'"/>'+
    '<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="'+(opt.color||'var(--accent)')+'" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+dash.toFixed(1)+' '+circ.toFixed(1)+'" transform="rotate(-90 '+c+' '+c+')"/>'+
    '<text x="'+c+'" y="'+cy+'" text-anchor="middle" font-size="'+(opt.big||19)+'" font-weight="800" fill="var(--ink)">'+center+'</text>'+sub+'</svg>';
}

/* ---------- viz: donut(正答率) + 概念ランキング(误答数/答过 ・ %) ---------- */
function weakVizNode(concepts,opt){
  opt=opt||{};
  const wrap=el('div',{class:'weakviz'});
  if(opt.donutPct!=null){
    const left=el('div',{class:'wv-donut'},[ svgNode(ringSVG(opt.donutPct,{sz:120,r:48,sw:13,big:30,color:'var(--ok)',sub:opt.donutSub||''})) ]);
    wrap.appendChild(left);
  }
  const list=el('div',{class:'wv-rank'});
  concepts.forEach(function(c){
    const s=conceptStat(c);
    const row=el('div',{class:'rkrow'},[
      el('button',{class:'rk-n jp',text:c,title:c,onclick:function(){ renderConcept(c,{from:opt.from||'result'}); }}),
      el('div',{class:'rk-bar'},[ el('div',{class:'rk-fill',style:'width:'+Math.round(s.rate*100)+'%'}) ]),
      el('span',{class:'rk-v',html:s.answered?(s.wrong+'/'+s.answered+t('vizSep')+'<b>'+Math.round(s.rate*100)+'%</b>'):'-'})
    ]);
    list.appendChild(row);
  });
  wrap.appendChild(list);
  return wrap;
}

function searchBarNode(){
  const box=el('button',{type:'button',class:'searchbar',onclick:function(){ renderSearch(''); }},[ // 検索の主入口 — 本物の button で Tab/Enter/Space と読み上げ名(中身の文言)を確保
    el('span',{class:'svgwrap','aria-hidden':'true',html:NEW_ICONS.search}),
    el('span',{class:'sbph jp',text:t('searchPh')})
  ]);
  return box;
}
function statCapNode(){ // StatusCard: 线性进度条（实绑真数 total=App.questions.length）
  const cap=el('div',{class:'stc'}); // 倒計時は greetsub(挨拶直下)へ移設 → ここは進捗カードのみ
  const solved=Object.keys(App.progress.seen||{}).length, total=App.questions.length;
  const pct=total?Math.round(solved/total*100):0, ja=App.lang==='ja';
  cap.appendChild(el('div',{class:'stc-pr'},[
    el('div',{class:'prh'},[ el('span',{class:'prl',text:t('progTitle')}), el('span',{class:'prn',text:solved+' / '+total}) ]),
    el('div',{class:'prbar'},[ el('i',{style:'width:'+pct+'%'+(pct>0?';min-width:10px':'')}) ]),
    el('div',{class:'prf'},[ el('span',{class:'prp',text:pct+'% '+t('progDone')}), el('span',{class:'prr',text:tf('progLeft',{n:total-solved})}) ])
  ]));
  return cap;
}
function homeHeroNode(hasExam){
  // 挨拶が主役 → 直下に試験日ライン(タップで設定へ) → 演習/復習ピル; 右列は進捗カードのみ
  const left=daysUntilExam(), pace=suggestedPace();
  let subHtml;
  if(left!=null&&left>0){ subHtml=examSubHtml(left,pace); }
  else if(left!=null&&left<=0){ subHtml=t('examDay'); }
  else { subHtml=t('setExam')+' ›'; }
  return el('div',{class:'hero1b'},[
    el('div',{class:'h1l'},[
      el('div',{class:'greet1b jp'},kaoWrap(greetMsg())),
      el('button',{class:'greetsub jp',html:subHtml,onclick:openExamDate})
    ]),
    homeSwitchNode(),
    el('div',{class:'h1r'},[ statCapNode() ])
  ]);
}
function homeSwitchNode(){
  function seg(tab,icon,title,sub){
    return el('button',{class:'hsw-b','data-tab':tab,'aria-pressed':String(App.homeTab===tab),onclick:function(){ switchHomeTab(tab); }},[ // 選択状態を読み上げにも出す
      el('span',{class:'swic',html:NEW_ICONS[icon]}),
      el('span',{class:'swt'},[ el('b',{text:title}), el('small',{class:'jp',text:sub}) ])
    ]);
  }
  return el('div',{class:'hsw','data-active':App.homeTab},[
    el('div',{class:'hsw-thumb'}),
    seg('exam','exam',t('segExam'),t('segExamD')),
    seg('review','book',t('segReview'),t('segReviewD'))
  ]);
}
function switchHomeTab(tab){ // iOS 風スライダー: thumb をずらし、内容だけ淡入で差し替え(全体再描画しない)
  if(App.homeTab===tab) return;
  App.homeTab=tab;
  const sw=document.querySelector('.hsw'); if(sw){ sw.setAttribute('data-active',tab); sw.querySelectorAll('.hsw-b').forEach(function(b){ b.setAttribute('aria-pressed',String(b.getAttribute('data-tab')===tab)); }); }
  const tc=document.getElementById('homeTabContent');
  if(!tc){ renderHome(); return; }
  const next=isRxCourse() ? (tab==='review' ? rxReviewTabNode() : rxExamTabNode()) : ((tab==='review') ? reviewTabNode(examResumable()) : examTabNode(examResumable())); // 新課も同じ切替（部品は rx-views）
  const reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){ tc.innerHTML=''; tc.appendChild(next); return; }
  tc.classList.add('hometab-out');                 // 退場: 淡出+微沈(.15s)
  setTimeout(function(){
    tc.innerHTML=''; tc.appendChild(next);          // 不可視の間に差し替え → 闪/reflow を隠す
    void tc.offsetWidth;                            // reflow で入場遷移を確実に発火
    tc.classList.remove('hometab-out');             // 入場: 下から柔らかく浮上+淡入(.24s, thumb .34s と同期)
  },150);
}
const FLAG_DECO='<svg width="210" height="210" viewBox="0 0 210 210" fill="none"><circle cx="150" cy="60" r="78" stroke="var(--accent)" stroke-width="1.4" opacity=".26"/><circle cx="150" cy="60" r="54" stroke="var(--accent)" stroke-width="1.4" opacity=".24"/><circle cx="150" cy="60" r="30" fill="var(--accent-wash)" stroke="var(--accent)" stroke-width="1.4" opacity=".5"/></svg>';
function homeTabWrap(side,main){ return el('div',{class:'htab'},[ el('div',{class:'htab-side'},side), el('div',{class:'htab-main'},main) ]); } // 演習｜復習の中身：側（旗卡・小卡）と主（面板・一覧）。窄屏はこの順に縦、≥1024 は主｜側の二栏（新課の宽栅格に臨床の部品を入れる：総指揮 10-18）
function flagNode(o){ // hero 解剖: pill → 大見出し(丸ゴ900) → 説明 → 全幅ピルCTA → 続行チップ
  const card=el('div',{class:'flag'},[
    el('span',{class:'fpill',text:o.pill}),
    el('div',{class:'fti jp',text:o.title}),
    el('div',{class:'fde jp',text:o.desc}),
    o.prog ? el('button',{class:'fcta jp has-prog',onclick:o.onCta},[ el('span',{class:'fcta-row'},[ document.createTextNode(o.cta+' '), el('span',{style:'font-size:16px',text:'›'}) ]), el('span',{class:'fprog mono',text:o.prog}) ]) // 位置は文の下の行（横に並べると狭い画面で文が折れて一字が孤立した）
           : el('button',{class:'fcta jp',onclick:o.onCta},[ document.createTextNode(o.cta+' '), el('span',{style:'font-size:16px',text:'›'}) ])
  ]);
  if(o.chip) card.appendChild(el('div',{class:'ffoot'},[ o.onChip ? el('button',{class:'fchip fchip-btn jp',onclick:o.onChip,text:o.chip}) : el('span',{class:'fchip jp',text:o.chip}) ]));
  return card;
}
function examTabNode(hasExam){
  const sv=hasExam?readExam():null, prog=(sv && sv.phase==='answering' && sv.ids)?((sv.pos+1)+' / '+sv.ids.length):null;
  const kids=[ hasExam ? flagNode({icon:'exam',pill:t('flagExamPill'),title:t('actExam'),desc:t('actExamD'),cta:t('glanceContinue'),prog:prog,onCta:resumeExam,chip:t('examOverwriteOk'),onChip:startExam}) // 中断した試験があれば主ボタン＝続き（位置つき）、最初からは下の小さな文字（従来の上書き確認を経る：U-53）
                     : flagNode({icon:'exam',pill:t('flagExamPill'),title:t('actExam'),desc:t('actExamD'),cta:t('flagExamCta'),onCta:startExam}) ];
  kids.push(el('div',{class:'subrow'},[ el('button',{class:'subcard',onclick:renderExamHistory},[ el('span',{class:'scic',html:NEW_ICONS.clock}), el('span',{class:'sctx'},[ el('b',{text:t('histTitle')}), el('small',{class:'jp',text:t('histSub')}) ]) ]), el('button',{class:'subcard',onclick:renderQuestionMarks},[ el('span',{class:'scic',html:NEW_ICONS.star}), el('span',{class:'sctx'},[ el('b',{text:t('subMarked')}), el('small',{class:'jp',text:t('subMarkedD')}) ]) ]) ]));
  if(feat('spaced')) kids.splice(1,0,spHomeNode()); // 旧課の今日の復習（S1-d）：試験カードのすぐ下
  return homeTabWrap(kids,[ rangePanelNode() ]); // 側＝試験の旗卡・今日の復習・小卡、主＝回をえらぶ（宽屏は二栏：合成版式）
}
function reviewTabNode(hasExam){
  const lr=App.course?lsGet(nk('lastRead'),null):null;
  const ck=(lr&&lr.kai)?lr.kai:12, cs=(lr&&lr.sec)?lr.sec:0, ct=kaiTitle(ck), jaR=App.lang==='ja';
  const chipTxt=(lr?tf('chipCont',{k:tf('kaiN',{n:ck})}):tf('kaiN',{n:ck}))+' '+((lr&&lr.sec)?readerResumeLabel(lr):(ct||'')); // 続読は節名まで（U-50） // chip=続読/注目回, 直接開く
  const flag=flagNode({icon:'book',pill:t('flagManualPill'),title:t('actManual'),desc:t('flagManualD2'),cta:t('flagManualCta'),onCta:function(){ renderReaderIndex(); },chip:lr?chipTxt:null,onChip:lr?function(){ resumeReader(lr); }:null}); // CTA=資料集ホーム(回一覧); 続き chip 仅在有 lastRead 记录时显示(同续考 hasExam 条件, 无记录不显示默认回)
  const subs=el('div',{class:'subrow'},[
    el('button',{class:'subcard',onclick:renderFlashcards},[ el('span',{class:'scic',html:NEW_ICONS.cards}), el('span',{class:'sctx'},[ el('b',{text:t('subCards')}), el('small',{class:'jp',text:t('subCardsD')}) ]) ]),
    el('button',{class:'subcard',onclick:renderReaderMarks},[ el('span',{class:'scic',html:NEW_ICONS.book}), el('span',{class:'sctx'},[ el('b',{text:t('subBook')}), el('small',{class:'jp',text:t('subBookD')}) ]) ])
  ]);
  return homeTabWrap([ flag, subs ],[ lookbackNode() ]);
}
function lookbackNode(){ // 学習の振り返り: 分野別 | 今週+苦手トップ + 演習への橋渡し
  const panel=el('div',{class:'spanel'},[ el('div',{class:'sph'},[ el('b',{text:t('lookbackTitle')}), el('small',{class:'jp',text:t('lookbackSub')}) ]) ]);
  const L1=el('div',null,[ el('div',{class:'lookh',text:t('lookField')}) ]);
  const rows=chapterStats();
  if(rows.length && rows.some(function(r){return r.answered>0;})){
    const grid=el('div',{class:'chgrid'}); L1.appendChild(grid); // 全行を一つの格子に：名前の幅が行ごとに違っても棒の位置と幅がそろう（U-86）
    rows.forEach(function(r){ const has=r.acc!=null;
      grid.appendChild(el('div',{class:'chrow2'},[
        el('div',{class:'chn jp',text:r.label}),
        el('div',{class:'chb'},[ el('i',{style:'width:'+(has?Math.round(r.acc*100):0)+'%'}) ]),
        el('div',{class:'chv',text:has?Math.round(r.acc*100)+'%':t('untouchedShort')})
      ]));
    });
  } else { L1.appendChild(el('div',{class:'gnone jp',style:'padding:6px 0',text:t('lookbackEmpty')})); }
  const R1=el('div',null,[ el('div',{class:'lookh',text:t('lookWeekTop')}) ]);
  const wa=weekActivity(), mx=Math.max.apply(null,wa.days.map(function(d){return d.n;}).concat([1]));
  const wrow=el('div',{class:'weekrow'}), wfmt=new Intl.DateTimeFormat(App.lang==='zh'?'zh-CN':'ja-JP',{weekday:'short'}); // 柱ごとに数と曜日（U-86）。0 の日は平らな線（数は出さない）
  wa.days.forEach(function(d,i){ const day=wfmt.format(new Date(d.start));
    wrow.appendChild(el('div',{class:'wk-col'+(i===6?' today':'')+(d.n?'':' zero'),title:day+' '+d.n},[ el('span',{class:'wk-v mono',text:d.n?String(d.n):''}),
      el('span',{class:'wk-bw'},[ el('i',{class:'wk-b',style:d.n?('height:'+Math.max(10,Math.round(d.n/mx*100))+'%'):''}) ]), el('span',{class:'wk-d jp',text:day}) ])); });
  R1.appendChild(wrow);
  R1.appendChild(el('div',{class:'weekn jp',html:t('lookWeekN')+' <b>'+wa.total+'</b> '+t('unitQ')}));
  R1.appendChild(el('div',{class:'lookdiv'}));
  R1.appendChild(el('div',{class:'lookh',text:t('lookWeakTop')}));
  const weak=Object.entries(App.progress.weakness||{}).sort(function(a,b){return b[1]-a[1];}).slice(0,3);
  if(weak.length){ weak.forEach(function(p){ const cs=conceptStat(p[0]); const acc=cs.answered?Math.round((1-cs.rate)*100):null;
    R1.appendChild(el('div',{class:'weakrow2'},[
      el('button',{class:'jp',text:p[0],title:p[0],onclick:function(){ renderConcept(p[0],{from:'home'}); }}),
      el('span',{class:'wv',text:acc!=null?acc+'%':String(p[1])})
    ]));
  }); } else { R1.appendChild(el('div',{class:'gnone jp',text:t('glanceNone')})); }
  panel.appendChild(el('div',{class:'lookgrid'},[ L1, R1 ]));
  panel.appendChild(el('div',{class:'bridge'},[
    el('span',{class:'btx jp',text:t('bridgeText')}),
    el('button',{class:'bgo jp',onclick:renderWrongList},[ document.createTextNode(t('bridgeGo')+' '), el('span',{class:'svgwrap',html:NEW_ICONS.arrowr}) ])
  ]));
  return panel;
}
function rangePanelNode(){
  const ks=progressKaiStats();
  function mkTile(k){ const s=ks[k], title=kaiTitle(k), topic=kaiTopic(k), has=s.acc!=null, p=has?Math.round(s.acc*100):0;
    return el('button',{class:'kt',onclick:function(){ startReviewKai(k); }},[
      el('div',{class:'kh'},[ el('span',{class:'kn',text:tf('kaiN',{n:k})}), el('span',{class:'kb '+(has?(p>=80?'hi':p>=50?'mid':'lo'):'todo'),text:has?tf('kaiAcc',{p:p}):t('untouched')}) ]), // U-19: 正答率と明記し、段階で色分け（done の緑＝学び終えた、に見えないように）
      el('div',{class:'ktt jp',text:title||'',title:title||''}),
      topic? el('div',{class:'ktopic jp',text:topic,title:topic}) : null,
      el('div',{class:'ktb'},[ el('i',{style:'width:'+Math.round(s.cov*100)+'%'}) ]),
      el('div',{class:'ksv mono',text:tf('kaiSolved',{a:s.seen,b:s.total})}) // 条＝解いた割合（覆盖率）であることを数字で
    ]);
  }
  /* 到達度按 CHAPTERS 分组(章扉感)+每章一 rmap 子网格; 表外回落 その他 */
  const groups=el('div',{class:'rmapgroups'}), seen={};
  CHAPTERS_OF().forEach(function(ch){
    const kais=ch.kais.filter(function(k){ return App.idx.kais.indexOf(k)>=0; }); if(!kais.length) return;
    kais.forEach(function(k){ seen[k]=1; });
    const sub=el('div',{class:'rmap'}); kais.forEach(function(k){ sub.appendChild(mkTile(k)); });
    groups.appendChild(el('div',{class:'rchap'},[
      el('div',{class:'rchaphd'},[ el('span',{class:'rchapname jp',text:L(ch)}), el('span',{class:'rchaprange mono',text:kaiRangeLabel(kais)}) ]), sub ]));
  });
  const leftover=App.idx.kais.filter(function(k){ return !seen[k]; });
  if(leftover.length){ const sub=el('div',{class:'rmap'}); leftover.forEach(function(k){ sub.appendChild(mkTile(k)); });
    groups.appendChild(el('div',{class:'rchap'},[ el('div',{class:'rchaphd'},[ el('span',{class:'rchapname jp',text:t('groupOther')}) ]), sub ])); }
  return el('div',{class:'spanel',id:'reviewHub'},[
    el('div',{class:'sph'},[ el('b',{text:t('rangeTitle')}), el('small',{class:'jp',text:t('rangeSub')}) ]),
    el('div',{class:'splede jp',text:t('rangeLede')}),
    el('div',{class:'rtiles'},[
      el('button',{class:'rtile',onclick:startRandom},[ el('span',{class:'rtic',html:NEW_ICONS.refresh}), el('span',{class:'rtx'},[ el('b',{class:'jp',text:t('randTile')}), el('small',{class:'jp',text:t('randTileD')}) ]) ]),
      el('button',{class:'rtile',onclick:renderWrongList},[ el('span',{class:'rtic',html:NEW_ICONS.bars}), el('span',{class:'rtx'},[ el('b',{class:'jp',text:t('weakTile')}), el('small',{class:'jp',text:t('weakTileD')}) ]) ])
    ]),
    el('div',{class:'rmaphd'},[ el('span',{class:'mhic',html:NEW_ICONS.grid}), el('div',{class:'rmaphd-t'},[ el('b',{class:'jp',text:t('kaiReachLabel')}), el('small',{class:'jp',text:t('kaiReachSub')}) ]) ]), // 見出しは折らず、説明が入らないときは丸ごと次の行へ（総指揮 2026-10-13：「い」一字の孤立行）
    groups
  ]);
}

function flashList(){ return App.idx.concepts.filter(function(c){ const m=App.idx.conceptMeta[c]; return m&&m.exists&&m.definition; }); }
function getCardMark(name){ return (App.progress.cardMarks||{})[name]||null; } // 'learned' | 'weak' | null
function toggleCardMark(name,mark){ if(!canWrite()) return getCardMark(name); const cm=App.progress.cardMarks||(App.progress.cardMarks={}); if(cm[name]===mark){ delete cm[name]; } else { cm[name]=mark; } saveProgress(); return cm[name]||null; } // 単選: 同じマーク再押しで解除
function deckList(){ let l=flashList(); if(App.progress.weakOnly){ return l.filter(function(c){ return getCardMark(c)==='weak'; }); } if(App.progress.hideLearned){ l=l.filter(function(c){ return getCardMark(c)!=='learned'; }); } return l; } // weakOnly が優先(苦手だけ) // 覚えたを隠す 時は learned を除外
/* 単語帳のキー（U-51）：カードに焦点が無くても効く。Space＝めくる、←→＝前後、1＝覚えた・2＝苦手（めくってから） */
function fcOnKey(e){ const K=App._fcKeys; if(!K || !K.root || !K.root.isConnected) return;
  if(e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
  if(typeof overlayOpen==='function' && overlayOpen()) return;
  const tg=(e.target&&e.target.tagName||'').toLowerCase(); if(tg==='input'||tg==='textarea'||tg==='select'||(e.target&&e.target.isContentEditable)) return;
  if(e.key===' '){ if(tg==='button'||tg==='a') return; e.preventDefault(); K.flip(); }
  else if(e.key==='ArrowRight'){ e.preventDefault(); K.go(1); } else if(e.key==='ArrowLeft'){ e.preventDefault(); K.go(-1); }
  else if(e.key==='1'){ K.rate('learned'); } else if(e.key==='2'){ K.rate('weak'); }
}
document.addEventListener('keydown',fcOnKey);
function renderFlashcards(){
  registerFrame(renderFlashcards,'flashcards');
  if(!App.flash){ const list=C.shuffle(deckList(),App.rng); App.flash={list:list,pos:0,flipped:false}; } // 覚えたを隠す 反映済みの牌組
  const F=App.flash;
  F.flipped=false; // 再入場は常に表面から描く(flipped 残留と視覚のねじれ→初回クリック空振り＋aria-hidden 逆貼りを断つ)
  const hideToggle=el('button',{class:'btn ghost sm fc-hide'+(App.progress.hideLearned?' on':''),text:t('cardHideLearned')});
  hideToggle.addEventListener('click',function(){ App.progress.hideLearned=!App.progress.hideLearned; App.progress.weakOnly=false; saveProgress(); App.flash=null; renderFlashcards(); }); // 切替→牌組再構築; 苦手だけと排他
  const weakToggle=el('button',{class:'btn ghost sm fc-hide'+(App.progress.weakOnly?' on':''),text:t('cardWeakOnly')}); // 苦手だけ専項復習
  weakToggle.addEventListener('click',function(){ App.progress.weakOnly=!App.progress.weakOnly; App.progress.hideLearned=false; saveProgress(); App.flash=null; renderFlashcards(); });
  const kids=[ sectionHead(t('actCards')) ];
  if(!F.list.length){ const emsg=App.progress.weakOnly?t('cardWeakEmpty'):(App.progress.hideLearned?t('cardDeckEmpty'):t('cardsEmpty'));
    const box=el('div',{class:'card'},[ el('p',{class:'muted jp',text:emsg}) ]);
    if(App.progress.weakOnly) box.appendChild(el('div',{style:'margin-top:10px;text-align:center'},[ weakToggle ]));
    else if(App.progress.hideLearned) box.appendChild(el('div',{style:'margin-top:10px;text-align:center'},[ hideToggle ]));
    kids.push(box); return setView(el('div',null,kids)); }
  // 真 3D 翻卡: 两面常驻 DOM, 翻面=切容器旋转类(.flipped, 不重渲); 换卡=瞬时复位旋转(.flip-instant 禁过渡, 绝不出现回翻)+方向性滑入(.flipstage fc-next/fc-prev, 镜像 qStep)。两面绝对叠放故容器须 JS 同步量测两面最大高度(sizeFlip)。reduced-motion 全程瞬时。
  function mReduceF(){ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  const finePtr=!!(window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches);
  const frontPad=el('div',{class:'fc-pad'},[ el('div',{class:'fc-q jp'}), el('div',{class:'fc-hint jp',text:t(finePtr?'clickReveal':'tapReveal')}) ]); // マウスの端末で「タップ」と書かない（U-51）
  const front=el('div',{class:'flip-face flip-front'},[ frontPad ]);
  const backPad=el('div',{class:'fc-pad'});
  const back=el('div',{class:'flip-face flip-back',id:'fcBack'},[ backPad ]);
  const inner=el('div',{class:'flip-inner'},[ front, back ]);
  // 翻卡=開示操作。裏面に .fc-og-link (対話的子孫)が居るので native button は使えず role=button で代替; 非表示面は aria-hidden+inert で読み上げ木から外す(答えの先バレ防止)
  const flip3d=el('div',{class:'flip3d',role:'button',tabindex:'0','aria-label':t('flipCard'),'aria-expanded':'false','aria-controls':'fcBack'},[ inner ]);
  let markBar=null; // 評価（覚えた・苦手）は裏返してから出す（U-51：表のままでも押せた）
  function syncFaces(){ const fl=!!F.flipped;
    if(markBar) markBar.classList.toggle('pre',!fl);
    flip3d.setAttribute('aria-expanded',String(fl));
    front.setAttribute('aria-hidden',String(fl)); back.setAttribute('aria-hidden',String(!fl));
    front.inert=fl; back.inert=!fl; }
  syncFaces();
  const stage=el('div',{class:'flipstage'},[ flip3d ]);
  const countEl=el('span',{class:'fc-count'});
  markBar=el('div',{class:'fc-marks'+(F.flipped?'':' pre')}); // 覚えた(緑)/苦手(桃) 単選トグル(現在カード)
  const bLearned=el('button',{class:'fcm fcm-learned',text:t('cardLearned')}), bWeak=el('button',{class:'fcm fcm-weak',text:t('cardWeak')});
  markBar.appendChild(bLearned); markBar.appendChild(bWeak);
  function paintMarks(){ const m=getCardMark(F.list[F.pos]); bLearned.classList.toggle('on',m==='learned'); bWeak.classList.toggle('on',m==='weak'); }
  let advT=null;
  function rate(kind){ const name=F.list[F.pos]; toggleCardMark(name,kind); paintMarks();
    if(getCardMark(name)===kind){ clearTimeout(advT); advT=setTimeout(function(){ if(F.list[F.pos]===name && stage.isConnected) gotoCard(1); },280); } } // 付けたら次のカードへ（外したときは留まる：U-51）
  bLearned.addEventListener('click',function(){ rate('learned'); });
  bWeak.addEventListener('click',function(){ rate('weak'); });
  function sizeFlip(){ const h=Math.max(frontPad.offsetHeight, backPad.offsetHeight, 230); inner.style.minHeight=h+'px'; } // 量测内容包裹层 offsetHeight (与容器高解耦, 不受 flex 居中对称溢出影响); 230 为下限
  function paintFace(){
    const name=F.list[F.pos]; const meta=App.idx.conceptMeta[name];
    front.querySelector('.fc-q').textContent=name;
    backPad.innerHTML='';
    backPad.appendChild(el('div',{class:'fc-term jp',text:name}));
    backPad.appendChild(el('div',{class:'fc-def jp',text:L(meta.definition)}));
    if(meta.origin) backPad.appendChild(el('button',{class:'fc-og-link',text:tf('ogRead',{n:meta.origin.kai}),onclick:function(e){ e.stopPropagation(); var sc=conceptReaderSec(meta.origin.kai,name); readerDir='fwd'; renderReader(meta.origin.kai, sc>=0?sc:0); }})); // 出処=資料集の該当節へ一本化(そこから読み+演習=関連問題に届くので「この概念に触れる問題」は冗長→削除)
    else backPad.appendChild(el('button',{class:'btn sm ghost',style:'margin-top:12px',text:t('related'),onclick:function(e){ e.stopPropagation(); renderConcept(name,{from:'home'}); }})); // 出処なし(manual外)概念のみ fallback
    countEl.textContent=(F.pos+1)+' / '+F.list.length;
    paintMarks();
    sizeFlip();
  }
  function doFlip(){
    F.flipped=!F.flipped;
    if(mReduceF()){ flip3d.classList.add('flip-instant'); flip3d.classList.toggle('flipped',F.flipped); requestAnimationFrame(function(){ flip3d.classList.remove('flip-instant'); }); syncFaces(); return; }
    flip3d.classList.toggle('flipped',F.flipped);
    syncFaces();
  }
  let swiped=0;
  flip3d.addEventListener('click',function(){ if(Date.now()-swiped<400) return; doFlip(); });
  (function(){ let x0=null,y0=0; // 左右のスワイプで前後のカード（U-51）
    stage.addEventListener('pointerdown',function(e){ if(e.pointerType==='mouse') return; x0=e.clientX; y0=e.clientY; });
    stage.addEventListener('pointerup',function(e){ if(x0==null) return; const dx=e.clientX-x0, dy=e.clientY-y0; x0=null;
      if(Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)*1.5){ swiped=Date.now(); gotoCard(dx<0?1:-1); } });
    stage.addEventListener('pointercancel',function(){ x0=null; }); })();
  flip3d.addEventListener('keydown',function(e){ // e.target 判定は必須 — 裏面 .fc-og-link 上の Enter が bubbling で二重発火するのを防ぐ
    if(e.target!==flip3d) return;
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); doFlip(); }
  });
  function resetRotation(){ flip3d.classList.add('flip-instant'); F.flipped=false; flip3d.classList.remove('flipped'); syncFaces(); inner.offsetHeight; requestAnimationFrame(function(){ flip3d.classList.remove('flip-instant'); }); } // 禁过渡→去 flipped→强制回流→下帧复原: 换卡瞬时复位、不见回翻
  function playStep(dir){
    if(mReduceF()) return;
    stage.classList.remove('fc-next','fc-prev'); stage.offsetWidth;
    stage.classList.add(dir==='next'?'fc-next':'fc-prev');
    let d=false; const cl=function(e){ if(e && e.target!==stage) return; if(d) return; d=true; stage.removeEventListener('animationend',cl); stage.classList.remove('fc-next','fc-prev'); };
    stage.addEventListener('animationend',cl); setTimeout(cl, 500);
  }
  function gotoCard(delta){ F.pos=(F.pos+delta+F.list.length)%F.list.length; resetRotation(); paintFace(); playStep(delta>0?'next':'prev'); }
  const nav=el('div',{class:'fc-nav'},[
    el('button',{class:'btn ghost sm',text:t('prevCard'),onclick:function(){ gotoCard(-1); }}),
    countEl,
    el('button',{class:'btn sm',text:t('nextCard'),onclick:function(){ gotoCard(1); }})
  ]);
  const tools=el('div',{class:'row',style:'margin-top:10px;justify-content:center;flex-wrap:wrap'},[
    el('button',{class:'btn ghost sm',text:t('shuffle'),onclick:function(){ App.flash.list=C.shuffle(deckList(),App.rng); App.flash.pos=0; App.flash.flipped=false; resetRotation(); paintFace(); }}),
    weakToggle, hideToggle
  ]);
  if(!window.__flipSizeBound){ // 全局一次性: resize / 字体晚载(Zen Maru)后重量测当前翻卡
    window.__flipSizeBound=true;
    var gs=function(){ var inr=document.querySelector('.flip-inner'); if(!inr) return; var f=inr.querySelector('.flip-front .fc-pad'), b=inr.querySelector('.flip-back .fc-pad'); if(!f||!b) return; inr.style.minHeight=Math.max(f.offsetHeight,b.offsetHeight,230)+'px'; };
    window.addEventListener('resize', gs);
    if(document.fonts && document.fonts.ready){ document.fonts.ready.then(gs); }
  }
  App._fcKeys={ flip:doFlip, go:gotoCard, rate:function(k){ if(F.flipped) rate(k); }, root:stage }; // 画面全体のキー（下の fcOnKey）
  kids.push(el('div',{class:'flashwrap'},[ stage, markBar, nav, tools ]));
  setView(el('div',null,kids));
  paintFace(); // setView 已挂载 → sizeFlip 可量测; 同步块内, 用户只见末态
}

/* ===================== 検索 =====================
 * 旧実装は「入力文字列そのままを q.q と q.topic、概念名と定義に indexOf」だけだった。
 * つまり:正規化なし・仮名の折り畳みなし・複数キーワード AND なし・ヒット強調なし・
 * 本文(手册)は検索対象ですらない・結果から本文の該当節へ跳べない。
 * 読む/さがす主体の神経では検索が主機能なので、作り直す。 */
function sNorm(s){
  s=(s||'').normalize('NFKC').toLowerCase();
  let o='';
  for(const ch of s){ const c=ch.codePointAt(0);
    o+= (c>=0x30A1&&c<=0x30F6) ? String.fromCodePoint(c-0x60) : ch; }  /* 片仮名→平仮名 */
  return o;
}
/* 1 文字の英数字(「8」「7」「a」)は、数字や語の内部にいくらでも当たる。
 * 引いた側に意味のある結果を返せないので、検索語として採らない。
 * 漢字・仮名 1 文字(「脳」「目」)は正当な検索なので残す。 */
function sTooShort(t){ return t.length===1 && /^[a-z0-9]$/.test(t); }
function sTerms(q){ return sNorm(q).split(/[\s　]+/).filter(Boolean).filter(function(t){ return !sTooShort(t); }); }
function sHasTooShort(q){ return sNorm(q).split(/[\s　]+/).filter(Boolean).some(sTooShort); }
/* 素の indexOf だと EDA が「(Geday 2003)」に、ERP が hyperpolarization に、ERN が Wernicke に
 * 当たっていた(実測)。仮名・漢字は語境界が無いので部分一致のままにし、
 * 短い英字トークン(4文字以下)だけ語境界を要求する。ただし片側でも境界に触れれば採用する——
 * そうしないと mri→fMRI、nirs→fNIRS のような前置合成語を落とす。 */
const S_WORD=/[a-z0-9]/;
function sShortLatin(t){ return t.length<=4 && /^[a-z0-9][a-z0-9.\-]*$/.test(t); }
function sFind(h,t){
  if(!sShortLatin(t)) return h.indexOf(t)>=0;
  let i=h.indexOf(t);
  while(i>=0){
    const l=(i>0)?h[i-1]:' ', r=(i+t.length<h.length)?h[i+t.length]:' ';
    if(!S_WORD.test(l) || !S_WORD.test(r)) return true;
    i=h.indexOf(t,i+1);            /* i+t.length だと重なる出現を飛ばして偽陰性になる */
  }
  return false;
}
function sHit(hay,terms){ const h=sNorm(hay); return terms.every(function(t){ return sFind(h,t); }); }
/* ヒット箇所を <mark> で出す。原文の見た目を保つため、正規化文字列でなく原文の index を使う。 */
/* 正規化(NFKC+仮名畳み)は文字数を変えることがある(半角カナ+濁点 2字 → 1字 など)。
 * 正規化後の添字でそのまま原文を切ると、ハイライトが隣の字にずれる
 * (「日本人」で引くと「人の業」が光っていた。実機で発見)。
 * 原文の各位置に対する正規化後の位置を作って、必ず原文の添字へ戻してから切る。 */
function normMap(raw){
  const map=[]; let out='';
  for(let i=0;i<raw.length;i++){
    const prev=out.length;
    out=sNorm(raw.slice(0,i+1));
    for(let k=prev;k<out.length;k++) map[k]=i;   /* 正規化後 k 文字目 → 原文 i 文字目 */
  }
  map[out.length]=raw.length;
  return {norm:out, map:map};
}
function rawSpan(nm,i,j){
  const a=(nm.map[i]!=null)?nm.map[i]:0;
  const b=(nm.map[j]!=null)?nm.map[j]:nm.map.length?nm.map[nm.map.length-1]:0;
  return [a,b];
}
function markNode(text,terms,cls){
  const wrap=el('span',{class:cls||''});
  const raw=String(text||'');
  const nm=normMap(raw), norm=nm.norm;
  const spans=[];
  terms.forEach(function(t){ let i=norm.indexOf(t);
    while(i>=0){
      /* 採否と同じ境界規則で塗る(不採用の出現まで光らせない) */
      const l=(i>0)?norm[i-1]:' ', r=(i+t.length<norm.length)?norm[i+t.length]:' ';
      if(!sShortLatin(t) || !S_WORD.test(l) || !S_WORD.test(r)){
        const sp=rawSpan(nm,i,i+t.length);
        if(sp[1]>sp[0]) spans.push(sp);
      }
      i=norm.indexOf(t,i+1);
    } });
  if(!spans.length){ wrap.appendChild(document.createTextNode(raw)); return wrap; }
  spans.sort(function(a,b){ return a[0]-b[0]; });
  const merged=[]; spans.forEach(function(sp){
    const last=merged[merged.length-1];
    if(last && sp[0]<=last[1]) last[1]=Math.max(last[1],sp[1]); else merged.push([sp[0],sp[1]]); });
  let cur=0;
  merged.forEach(function(m){
    if(m[0]>cur) wrap.appendChild(document.createTextNode(raw.slice(cur,m[0])));
    wrap.appendChild(el('mark',{class:'hl-hit',text:raw.slice(m[0],m[1])}));
    cur=m[1];
  });
  if(cur<raw.length) wrap.appendChild(document.createTextNode(raw.slice(cur)));
  return wrap;
}
function snippet(text,terms,len){
  const raw=String(text||'');
  const nm=normMap(raw), norm=nm.norm;
  let at=-1;
  terms.some(function(t){ const i=norm.indexOf(t); if(i>=0){ at=nm.map[i]!=null?nm.map[i]:0; return true; } return false; });
  len=len||58;
  if(at<0) return raw.slice(0,len)+(raw.length>len?'…':'');
  const from=Math.max(0,at-16);
  return (from?'…':'')+raw.slice(from,from+len)+((from+len<raw.length)?'…':'');
}
/* 検索対象コーパスを course の実データから組む。手册本文(定義・箇条・口頭・対比表セル・
 * 教員の一言・caveat)まで拾うのが要点。 */
function buildSearchCorpus(){
  if(App._corpus && App._corpusFor===(App.course&&App.course.id)+'|'+App.lang) return App._corpus; // 課と言語ごと（日／中の切替で定義・解説の言語が残っていた）
  const rows=[];
  const cm=App.idx?App.idx.conceptMeta:{};
  Object.keys(cm).forEach(function(name){
    const meta=App.concepts?App.concepts[name]:null;
    const def=cm[name]&&cm[name].definition?(L(cm[name].definition)||''):'';
    rows.push({kind:'concept', term:name, def:def,
      hay:[name, def, (meta&&meta.yomi)||'', ((meta&&meta.aliases)||[]).join(' '),
           ((meta&&meta.tags)||[]).join(' ')].join(' '),
      kai:(meta&&meta.kai)||((cm[name].origin&&cm[name].origin.kai)||null),
      cardId:(meta&&meta.cardId)||null, axis:(meta&&meta.axis)||''});
  });
  manualUnits().forEach(function(u){
    (u.sections||[]).forEach(function(s,i){
      (s.blocks||[]).forEach(function(b){
        if(b.type==='concept'){
          const body=LL(b.bullets).concat(LL(b.heard)).join(' ');
          const cav=b.caveat?[b.caveat.correct,b.caveat.course,b.caveat.exam].join(' '):'';
          const sig=b.signal?b.signal.quote:'';
          rows.push({kind:'body', term:b.term, cardId:b.cardId, kai:u.kai, sec:i+1,
            anchor:'c-'+b.cardId, body:body, sig:sig, cav:cav,
            hay:[body,sig,cav].join(' ')});
        }
        if(b.type==='compare'){
          const cells=(b.members||[]).map(function(m){ return m.term+' '+(m.cells||[]).join(' '); }).join(' ');
          rows.push({kind:'compare', term:b.title, gid:b.id, kai:u.kai, sec:i+1, anchor:'g-'+b.id,
            body:(b.axis||[]).join('・'), hay:[b.title,(b.axis||[]).join(' '),cells].join(' ')});
        }
      });
    });
  });
  (App.questions||[]).forEach(function(q){
    rows.push({kind:'q', q:q, hay:[q.q||'', q.topic||'', (q.options||[]).map(function(o){return o.t;}).join(' '),
      L(q.explainShort||{})||''].join(' ')});
  });
  App._corpus=rows; App._corpusFor=(App.course&&App.course.id)+'|'+App.lang;
  return rows;
}
function renderSearch(initial){
  registerFrame(function(){ renderSearch(App._searchQ||''); },'search');
  App._searchQ=initial!=null?initial:(App._searchQ||'');
  const kids=[ sectionHead(t('searchTitle')) ];
  const card=el('div',{class:'card'});
  const back=(navDir==='back'); // 戻ってきたときは入力欄に焦点を入れない（キーボードが結果を隠さない）
  const input=el('input',{class:'searchinput jp',type:'search',enterkeyhint:'search',placeholder:t('searchPh')});
  input.value=App._searchQ;
  const out=el('div',{class:'searchout'});
  function run(){
    App._searchQ=input.value;
    const terms=sTerms(input.value);
    out.innerHTML='';
    if(!terms.length){
      out.appendChild(el('div',{class:'gnone jp',
        text: sHasTooShort(input.value) ? t('srTooShort')
                                        : t('searchHint')}));
      return;
    }
    const rows=buildSearchCorpus().filter(function(r){ return sHit(r.hay,terms); });
    const cons=rows.filter(function(r){ return r.kind==='concept'; });
    const bods=rows.filter(function(r){ return r.kind==='body'; });
    const cmps=rows.filter(function(r){ return r.kind==='compare'; });
    const qs  =rows.filter(function(r){ return r.kind==='q'; });
    /* 並び:当たり方の強さで順位を付ける。
     * 「のうは」で引いたとき、読みが完全一致する「脳波」より、読みに たまたま その音を含む
     * 「大脳半球の側性化」が先に出ると使いものにならない。一致の質を見る。 */
    const score=function(r){
      const meta=App.concepts?App.concepts[r.term]:null;
      const term=sNorm(r.term), yomi=sNorm((meta&&meta.yomi)||'');
      const q=terms.join('');
      let s=0;
      if(term===q || yomi===q) s+=100;
      if(term.indexOf(q)===0 || yomi.indexOf(q)===0) s+=40;
      if(sHit(r.term,terms)) s+=25;
      if(((meta&&meta.aliases)||[]).some(function(a){ return sNorm(a)===q; })) s+=30;
      if(sHit(r.def||'',terms)) s+=5;
      s-=Math.min(term.length,20)*0.2;                 // 同点なら短い見出し語を上に
      return s;
    };
    cons.sort(function(a,b){ return score(b)-score(a); });
    const bodOnly=bods.filter(function(r){ return !cons.some(function(c){ return c.cardId===r.cardId; }); });
    const total=cons.length+bodOnly.length+cmps.length+qs.length;
    if(!total){ out.appendChild(el('div',{class:'gnone jp',text:t('searchNone')})); return; }
    out.appendChild(el('div',{class:'srsum jp',
      text:tf('srHits',{n:total})+(terms.length>1?t('srAllTerms'):'')}));

    function jumpRow(r){
      const b=el('button',{class:'srow',onclick:function(){
        if(r.kind==='q'){ renderReading(r.q.id,{from:'search'}); return; }
        if(r.kind==='compare'){ gotoCompare(r.gid); return; }
        gotoCard(r.cardId,r.term);
      }});
      return b;
    }
    if(cons.length){
      out.appendChild(el('div',{class:'srhd jp',text:t('srConcepts')+' ('+cons.length+')'}));
      cons.slice(0,40).forEach(function(r){
        const b=jumpRow(r);
        const main=el('span',{class:'sr-m'});
        main.appendChild(markNode(r.term,terms,'sr-term jp'));
        /* 「しさいぼう」で引くと 視細胞 が当たるが、見出しにも定義にも文字が無いので
         * なぜ当たったのか分からない。当たった読み/別名をその場に出す。 */
        const meta=App.concepts?App.concepts[r.term]:null;
        if(meta && !sHit(r.term,terms) && !sHit(r.def||'',terms)){
          const via=[];
          if(meta.yomi && sHit(meta.yomi,terms)) via.push({l:t('srYomi'), v:meta.yomi});
          (meta.aliases||[]).forEach(function(a){ if(sHit(a,terms) && via.length<2) via.push({l:t('srAlias'), v:a}); });
          if(via.length){
            const vr=el('span',{class:'sr-via'});
            via.forEach(function(x){ vr.appendChild(el('span',{class:'sv-c'},[
              el('em',{text:x.l}), markNode(x.v,terms) ])); });
            main.appendChild(vr);
          }
        }
        main.appendChild(el('small',{class:'jp'},[ markNode(snippet(r.def,terms,52),terms) ]));
        b.appendChild(main);
        b.appendChild(el('span',{class:'sr-k',text:(r.kai?tf('kaiN',{n:r.kai}):'')+(r.axis?(' · '+r.axis):'')}));
        out.appendChild(b);
      });
    }
    if(bodOnly.length){
      out.appendChild(el('div',{class:'srhd jp',style:'margin-top:12px',
        text:t('srBody')+' ('+bodOnly.length+')'}));
      bodOnly.slice(0,40).forEach(function(r){
        const b=jumpRow(r);
        const main=el('span',{class:'sr-m'});
        main.appendChild(el('span',{class:'sr-term jp',text:r.term}));
        const src=sHit(r.sig||'',terms)?r.sig:(sHit(r.cav||'',terms)?r.cav:r.body);
        main.appendChild(el('small',{class:'jp'},[ markNode(snippet(src,terms,64),terms) ]));
        b.appendChild(main);
        b.appendChild(el('span',{class:'sr-k',text:tf('kaiN',{n:r.kai})}));
        out.appendChild(b);
      });
    }
    if(cmps.length){
      out.appendChild(el('div',{class:'srhd jp',style:'margin-top:12px',text:t('rcCompare')+' ('+cmps.length+')'}));
      cmps.slice(0,20).forEach(function(r){
        const b=jumpRow(r);
        const main=el('span',{class:'sr-m'});
        main.appendChild(markNode(r.term,terms,'sr-term jp'));
        main.appendChild(el('small',{class:'jp',text:r.body}));
        b.appendChild(main);
        b.appendChild(el('span',{class:'sr-k',text:(r.kai?tf('kaiN',{n:r.kai}):'')}));
        out.appendChild(b);
      });
    }
    if(qs.length){
      out.appendChild(el('div',{class:'srhd jp',style:'margin-top:12px',text:t('q')+' ('+qs.length+')'}));
      qs.slice(0,20).forEach(function(r){
        const b=jumpRow(r);
        const main=el('span',{class:'sr-m'});
        main.appendChild(el('span',{class:'sr-term jp',text:tf('kaiN',{n:r.q.kai})+' · '+(r.q.topic||'')}));
        main.appendChild(el('small',{class:'jp'},[ markNode(snippet(r.q.q,terms,64),terms) ]));
        b.appendChild(main);
        b.appendChild(el('span',{class:'sr-k',text:r.q.kind||''}));
        out.appendChild(b);
      });
    }
  }
  let composing=false, tmr=null; // 日本語入力の変換中は検索しない（確定前に「見つかりません」を出さない）・打鍵ごとではなく少し待ってから
  input.addEventListener('compositionstart',function(){ composing=true; });
  input.addEventListener('compositionend',function(){ composing=false; run(); });
  input.addEventListener('input',function(e){ if(composing||e.isComposing) return; clearTimeout(tmr); tmr=setTimeout(run,150); });
  card.appendChild(el('div',{class:'searchrow'},[ svgNode(NEW_ICONS.search), input ]));
  card.appendChild(out);
  kids.push(card);
  setView(el('div',null,kids));
  setTimeout(function(){ if(!back){ try{ input.focus(); }catch(e){} } run(); },0);
}

function readerBookmarkList(){ // 資料集ブックマーク ["kai:sec"] → [{kai,sec,label,tag}]（renderReader へ跳ぶ）
  const arr=lsGet(nk('readerBm'),[])||[]; const ja=App.lang==='ja';
  return arr.map(function(k){ const p=String(k).split(':'), kai=parseInt(p[0],10), sec=parseInt(p[1],10);
    const unit=(App.manual&&App.manual.units)?App.manual.units.find(function(u){return u.kai===kai;}):null; if(!unit) return null;
    const secs=unit.sections||[];
    const title=(sec===0)?t('rdrIntro'):((secs[sec-1]&&secs[sec-1].title)||'');
    const tag=(sec===0)?t('rdrCover'):((secs[sec-1]&&secs[sec-1].sectionId)||'');
    return { kai:kai, sec:sec, label:tf('kaiN',{n:kai})+' · '+title, tag:tag };
  }).filter(Boolean);
}
function renderQuestionMarks(){ // 問題の★（做题中の標記）
  registerFrame(renderQuestionMarks,'qmarks');
  const ids=Object.keys(getBookmarks()).filter(function(id){ return App.idx.byId[id]; });
  const kids=[ sectionHead(t('subMarked')) ];
  if(!ids.length){ kids.push(el('div',{class:'card'},[ el('p',{class:'muted jp',text:t('markEmpty')}) ])); return setView(el('div',null,kids)); }
  const card=el('div',{class:'card'});
  card.appendChild(el('button',{class:'btn',style:'margin-bottom:12px',text:t('retryBook'),onclick:function(){
    const list=C.reviewSample(App.questions,{onlyIds:ids,count:Math.min(ids.length,30),recentIds:App.recent},App.rng);
    newSession('review',list,{}); renderRunner();
  }}));
  ids.forEach(function(id){ const q=App.idx.byId[id];
    card.appendChild(rowBtn(tf('kaiN',{n:q.kai})+' · '+(q.topic||''), q.kind, function(){ renderReading(id,{from:'book'}); }));
  });
  kids.push(card);
  setView(el('div',null,kids));
}
function renderReaderMarks(){ // まとめノートの★（しおり）
  registerFrame(renderReaderMarks,'rmarks');
  const rbm=readerBookmarkList();
  const kids=[ sectionHead(t('subBook')) ];
  if(!rbm.length){ kids.push(el('div',{class:'card'},[ el('p',{class:'muted jp',text:t('shioriEmpty')}) ])); return setView(el('div',null,kids)); }
  const rcard=el('div',{class:'card'});
  rbm.forEach(function(b){ rcard.appendChild(rowBtn(b.label, b.tag, (function(bb){ return function(){ renderReader(bb.kai,bb.sec); }; })(b))); });
  kids.push(rcard);
  setView(el('div',null,kids));
}
/* 现无 UI 入口（入口缺失，非废弃）：复活或退役待裁定，勿当死代码删除。 */
function renderBookmarks(){ return renderQuestionMarks(); } // 旧互換（外部呼び出しは問題★へ）

/* ===================== ホーム画面に追加 (PWA): iOS Safari 検出 + 一回限りの軽バナー + 図解チュートリアル ===================== */
function isIOSWebKit(){ // iPhone・iPad の Safari（またはそのホーム画面アプリ）
  try{
    const ua=navigator.userAgent||'';
    const iOS=/iPhone|iPad|iPod/.test(ua) || (navigator.platform==='MacIntel' && (navigator.maxTouchPoints||0)>1); // iPadOS13+ は Mac を詐称
    const webkit=/WebKit/.test(ua);
    const other=/CriOS|FxiOS|EdgiOS|OPiOS|mercury|DuckDuckGo/.test(ua); // iOS 上の Chrome/FF/Edge 等は「追加」UI が無いので除外
    return iOS && webkit && !other;
  }catch(e){ return false; }
}
function isStandaloneApp(){ try{ return (window.navigator.standalone===true) || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); }catch(e){ return false; } }
function isIOSSafari(){ return isIOSWebKit() && !isStandaloneApp(); }
function isMacSafari(){ // U-33: 触点の無い Mac の Safari だけ（Mac の Chrome などには「Dockに追加」が無い）
  try{
    const ua=navigator.userAgent||'';
    return navigator.platform==='MacIntel' && (navigator.maxTouchPoints||0)<=1 && !/iPhone|iPad|iPod/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|Firefox|OPR\//.test(ua);
  }catch(e){ return false; }
}
function hasLearningData(){ // U-03:「この端末にまだ記録が無い」の判定。起動時に書く lastCourse・lang などは数えない
  try{
    for(let i=0;i<localStorage.length;i++){
      const m=(localStorage.key(i)||'').match(/^quiz:[^:]+:(.+)$/); if(!m) continue;
      if(/^(sched|rx:sched|rx:log|examHistory|examInProgress|bookmarks|readerBm)$/.test(m[1])) return true;
      if(m[1]==='progress'){ const p=JSON.parse(localStorage.getItem(localStorage.key(i))||'null'); if(p && ((Array.isArray(p.attempts)&&p.attempts.length) || Object.keys(p.seen||{}).length)) return true; }
    }
  }catch(e){ return true; } // 読めないときはカードを出さない
  return false;
}
function a2hsImportCardNode(){ // U-03: ホーム画面アプリを初めて開いたとき、Safari で書き出したファイルの取り込みを先に案内（あとで＝以後出さない）
  if(!(isIOSWebKit() && isStandaloneApp()) || lsGet('quiz:a2hs-imp-x') || hasLearningData()) return null;
  const inp=el('input',{type:'file',accept:'application/json,.json',style:'display:none'}); inp.addEventListener('change',doImport);
  const card=el('div',{class:'a2hs-imp'},[
    el('div',{class:'a2hs-imp-t jp',text:t('a2hsImportTitle')}),
    el('p',{class:'a2hs-imp-b jp',text:t('a2hsImportBody')}),
    el('div',{class:'row'},[
      el('button',{type:'button',class:'btn sm',text:t('importBtn'),onclick:function(){ inp.value=''; inp.click(); }}),
      el('button',{type:'button',class:'btn ghost sm',text:t('a2hsLater'),onclick:function(){ lsSet('quiz:a2hs-imp-x',1); card.remove(); }}),
      inp ])
  ]);
  return card;
}
function a2hsBannerNode(){ // ホーム上部に一度だけ; ×で恒久的に消す
  if(!isIOSSafari() || lsGet('quiz:a2hs-x')) return null;
  const bar=el('div',{class:'a2hsbar'});
  bar.appendChild(el('span',{class:'a2hsbar-ic',html:NEW_ICONS.share}));
  bar.appendChild(el('span',{class:'a2hsbar-t jp',text:t('a2hsBannerText')})); // 「記録は別」の注意は横幅に載せず、ボタンで開く手順の先頭に（総指挥裁定：横幅を重くしない）
  const go=el('button',{class:'a2hsbar-go jp',text:t('a2hsBtn'),onclick:openAddToHome});
  const x=el('button',{class:'a2hsbar-x','aria-label':t('a2hsLater'),text:'\u00D7',onclick:function(){ lsSet('quiz:a2hs-x',1); bar.remove(); }});
  bar.appendChild(el('div',{class:'a2hsbar-act'},[ go, x ]));
  return bar;
}
function openAddToHome(){
  const SHARE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M5 11v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/></svg>';
  const ADD='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 9v6M9 12h6"/></svg>';
  const CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  /* iPad の Safari は共有ボタンが右上の常設ツールバーにある。iPadOS は Mac を名乗るため触点数で見分ける。
     iPhone の Safari 27 以降は「⋯」がなく、アドレス欄左端の三本線のボタンから「共有」へ行く（iOS 27 シミュレータで確認）。版は UA の Version/ で見る（OS 版の表記は固定されている） */
  const MENU='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/></svg>';
  const ua=navigator.userAgent||'';
  const mac=isMacSafari(); // U-33: Mac の Safari は「ファイル」メニューの「Dockに追加」（Safari 17 以降）
  const isPad=/iPad/.test(ua) || (navigator.platform==='MacIntel' && (navigator.maxTouchPoints||0)>1);
  const safariMajor=parseInt((ua.match(/Version\/(\d+)/)||[])[1]||'0',10);
  const step1=isPad?'a2hsStep1Pad':(safariMajor>=27?'a2hsStep1V27':'a2hsStep1');
  const steps=mac ? [ [MENU,t('a2hsMacStep1')], [ADD,t('a2hsMacStep2')], [CHECK,t('a2hsMacStep3')] ]
                  : [ [SHARE,t(step1)], [ADD,t('a2hsStep2')], [CHECK,t('a2hsStep3')] ];
  const body=[ el('div',{class:'a2hs-intro jp',text:t(mac?'a2hsIntroMac':'a2hsIntro')}),
    el('div',{class:'a2hs-sep'},[ el('p',{class:'jp',text:t(mac?'a2hsSepNoteMac':'a2hsSepNote')}), // U-03: 追加したアプリは Safari と記録が別（Apple 104996）→ 先に書き出す
      el('button',{type:'button',class:'btn ghost sm',text:t('a2hsExportFirst'),onclick:function(){ doExport(false); }}) ]) ];
  const list=el('div',{class:'a2hs-steps'});
  steps.forEach(function(s,i){
    list.appendChild(el('div',{class:'a2hs-step'},[
      el('span',{class:'a2hs-num',text:String(i+1)}),
      el('span',{class:'a2hs-ic',html:s[0]}),
      el('span',{class:'a2hs-tx jp',text:s[1]})
    ]));
  });
  body.push(list);
  if(!mac) body.push(el('div',{class:'a2hs-prev'},[
    el('img',{class:'a2hs-prev-ic',src:'apple-touch-icon.png',alt:'\u10DB\u10D4\u10D8\u10DB\u10D4\u10D8',width:'52',height:'52'}),
    el('span',{class:'a2hs-prev-t jp',text:t('a2hsPreview')})
  ]));
  openModal(modalShell(t(mac?'a2hsBtnMac':'a2hsTitle'),body));
}
function openExamDate(){ // 試験日専用ダイアログ(StatusCard の鉛筆から); 設定パネルからは分離
  const dateInp=el('input',{type:'date',class:'dateinput','aria-label':t('examTitle')}); const cur=getExamDate(); if(cur) dateInp.value=cur; const dateErr=el('p',{class:'jp warn',role:'alert',hidden:'hidden'}); // 無名の日付欄に読み上げ名を与える
  openModal(modalShell(t('examTitle'),[ // 日付を選んでいるあいだは下書き：「保存」で初めて反映（選ぶ途中で首页が冲刺に切り替わらない）
    el('div',{class:'sethelp jp',text:t('examHelp')}),
    dateErr,
    el('div',{class:'row',style:'align-items:center;flex-wrap:wrap;gap:8px'},[ dateInp,
      el('button',{class:'btn sm',text:t('examSave'),onclick:function(){ if(!canWrite()) return; if(setExamDate(dateInp.value||null)) closeModal(); else { dateErr.textContent=t('storageBlocked'); dateErr.hidden=false; } }}), // 保存できなければ閉じない：入力を残し、理由を出す（CR-15） // 只読：説明に差し替わったのを次の closeModal で消していた（日付も残らず説明も出なかった：复查 N-02）
      el('button',{class:'btn ghost sm',text:t('clear'),onclick:function(){ dateInp.value=''; }}) ])
  ]));
}
function openSettings(){
  const hand=getHand();
  const handRow=el('div',{class:'setseg'});
  ['right','left'].forEach(function(h){
    const b=el('button',{class:'segbtn'+(hand===h?' on':''),text:h==='right'?t('handRight'):t('handLeft')});
    b.addEventListener('click',function(){ setHand(h); handRow.querySelectorAll('.segbtn').forEach(function(x){ x.classList.remove('on'); }); b.classList.add('on'); if(App.session&&document.querySelector('.runner')) renderRunner(); });
    handRow.appendChild(b);
  });
  const th=lsGet('quiz:theme','auto'), themeRow=el('div',{class:'setseg theme-seg',role:'group','aria-label':t('setTheme')});
  [['auto','themeAuto'],['light','themeLight'],['dark','themeDark']].forEach(function(x){
    const b=el('button',{class:'segbtn'+(th===x[0]?' on':''),'aria-pressed':String(th===x[0]),text:t(x[1])});
    b.addEventListener('click',function(){ setThemePref(x[0]); themeRow.querySelectorAll('.segbtn').forEach(function(y){ y.classList.remove('on'); y.setAttribute('aria-pressed','false'); }); b.classList.add('on'); b.setAttribute('aria-pressed','true'); });
    themeRow.appendChild(b);
  });
  const body=[
    el('div',{class:'setblk'},[ el('div',{class:'setlbl jp',text:t('ioTitle')}),
      isIOSWebKit()?el('div',{class:'sethelp jp',text:t(isStandaloneApp()?'setStoreHome':'setStoreSafari')}):null // U-03: いまの記録がどちら側のものか（iPhone・iPad だけ）
    ].filter(Boolean).concat(ioBlock(false))), /* 書き出し/読み込み (reset は末尾へ) */
    el('div',{class:'setblk'},[ el('div',{class:'setlbl jp',text:t('handTitle')}), el('div',{class:'sethelp jp',text:t('handHelp')}), handRow ]),
    el('div',{class:'setblk'},[ el('div',{class:'setlbl jp',text:t('setTheme')}), el('div',{class:'sethelp jp',text:t('setThemeHelp')}), themeRow ]), // U-43（快审第二十一批 K2-10）
    el('div',{class:'setblk'},[ el('div',{class:'setlbl jp',text:t(isMacSafari()?'a2hsBtnMac':'a2hsBtn')}), el('div',{class:'sethelp jp',text:t(isMacSafari()?'a2hsIntroMac':'a2hsHelp')}),
      el('button',{class:'btn ghost sm',text:t(isMacSafari()?'a2hsBtnMac':'a2hsBtn'),onclick:openAddToHome}) ]), /* ホーム画面に追加 (試験日は StatusCard の鉛筆→openExamDate に分離) */
    el('div',{class:'setblk'},[ el('div',{class:'setlbl jp',text:t('verLabel')}),
      el('button',{class:'btn ghost sm',onclick:openUpdates,html:'<span class="mono">v'+APP_VERSION+'</span> · '+t('updTitle')}) ]), /* 版本 chip 移出顶栏黄金位 → 收进设置 */
    el('div',{class:'setblk'},[ el('div',{class:'setlbl jp',text:t('resetTitle')}),
      el('div',{class:'row'},[
        el('button',{class:'btn ghost',text:t('resetProg'),onclick:doResetProgress}),
        el('button',{class:'btn ghost',style:'border-color:var(--no-line);color:var(--no-deep)',text:t('reset'),onclick:doReset}) ]) ])
  ];
  if(isRxCourse()) body.splice(1,0,rxVaultSettingsBlock()); // 新課：真題の解錠（ここでのみ口令を入力）
  if(typeof swSettingsBlock==='function') body.splice(body.length-2,0,swSettingsBlock()); // オフライン（版・リセットの前）
  openModal(modalShell(t('setTitle'),body));
}

/* ===================== care 节奏 (练习: 在场时长 + 答题里程碑 + 错误聚集 + 疲劳; 离页冻结; 考试中不弹) ===================== */
/* 时间基准 = 练习在场累计 (clockShouldRun 已扩展; 离页时 onVisibility 冻结 elapsed -> 节奏自动暂停, 不另造在场判定) */
var CARE_FIRST=13, CARE_MIN_GAP=8, CARE_MIN_GAP_SOFT=5, CARE_GAP_NORMAL=15, CARE_FATIGUE_AT=40, CARE_GAP_TIRED=10, CARE_MILESTONE_Q=30, CARE_ERR_K=5; // 单位: 分钟 / 题
function practiceElapsedMin(){ var s=App.session; if(!s||s.mode==='exam') return 0; var ms=(s.elapsedMs||0)+(s.runningSince?(Date.now()-s.runningSince):0); return ms/60000; }
function clearCareTimer(){ if(App.careInt){ clearInterval(App.careInt); App.careInt=null; } if(App.careFirst){ clearTimeout(App.careFirst); App.careFirst=null; } }
function startCareTimer(){ clearCareTimer(); App.careInt=setInterval(maybeCarePop, 30000); } // 心跳; 判定全在 maybeCarePop, 离页 elapsed 不前进故不弹
function maybeCarePop(){
  var s=App.session; if(!s || s.mode==='exam' || document.hidden) return;
  var tmin=practiceElapsedMin(); if(tmin < CARE_FIRST) return;
  var sinceCare = tmin - (s.lastCareElapsed||0);
  var win=s.recentWindow||[], wrongs=0; for(var i=0;i<win.length;i++){ if(!win[i]) wrongs++; }
  if(wrongs >= CARE_ERR_K && sinceCare >= CARE_MIN_GAP_SOFT){ fireCarePop('empathy'); s.lastCareElapsed=tmin; s.lastCareAnswered=s.answeredCount||0; s.recentWindow=[]; return; }
  if(sinceCare < CARE_MIN_GAP) return;
  if(((s.answeredCount||0)-(s.lastCareAnswered||0)) >= CARE_MILESTONE_Q){ fireCarePop('care'); s.lastCareElapsed=tmin; s.lastCareAnswered=s.answeredCount||0; return; }
  var gap=(tmin >= CARE_FATIGUE_AT) ? CARE_GAP_TIRED : CARE_GAP_NORMAL;
  if(sinceCare >= gap){ fireCarePop('care'); s.lastCareElapsed=tmin; s.lastCareAnswered=s.answeredCount||0; return; }
}
function fmtClock(sec){ sec=Math.max(0,Math.floor(sec)); const m=Math.floor(sec/60), s=sec%60; return m+':'+String(s).padStart(2,'0'); }
function clearRunnerTimer(){ if(App.runnerTimer){ clearInterval(App.runnerTimer); App.runnerTimer=null; } }
function startRunnerTimer(node){ clearRunnerTimer(); if(!node||!App.session) return; // アイコンは一度だけ組み, 毎秒は時間 span のみ更新
  node.innerHTML='<span class="qt-ic">'+NEW_ICONS.clock+'</span><span class="qt-t"></span>';
  const tEl=node.querySelector('.qt-t');
  function upd(){ if(!node.isConnected||!App.session){ clearRunnerTimer(); return; } tEl.textContent=fmtClock(examElapsed()/1000); }
  upd(); App.runnerTimer=setInterval(upd,1000);
}
let careTick=0;
function fireCarePop(kind){
  try{
    careTick++; var icon=pick(REST_ICONS); var msg; // 真随机 pick(旧: careTick 顺送り)
    if(kind==='empathy'){ msg=pick(t('encWrong')); }
    else { msg=pick(t('carePool')); }
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var rp=el('div',{class:'rp'},[ el('div',{class:'rpic',style:'display:flex;justify-content:center;line-height:0',html:icon}), el('div',{class:'rpt'},[kaoWrap(msg)]) ]);
    var pop=el('div',{class:'restpop'+(reduce?'':' anim')},[ rp ]);
    document.body.appendChild(pop);
    setTimeout(function(){ if(pop&&pop.parentNode) pop.parentNode.removeChild(pop); }, reduce?1600:2900);
  }catch(e){}
}

/* ===================== updates modal（用户向、温和、颜文字；详细在 CHANGELOG/dev） ===================== */
function openUpdates(){
  const body=[];
  UPDATES.forEach(function(u){
    const blk=el('div',{class:'updblk'},[ el('div',{class:'updv'},[ el('b',{text:'v'+u.v}) ]) ]);
    const ul=el('ul',{class:'updul'});
    (u.items[App.lang]||u.items.ja).forEach(function(it){ ul.appendChild(el('li',{class:'jp',text:it})); });
    blk.appendChild(ul); body.push(blk);
  });
  openModal(modalShell(t('updTitle'),body));
}
