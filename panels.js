'use strict';
/* ---------- small builders ---------- */
function sectionHead(title,back){ return el('div',{class:'sechd'},[ el('button',{class:'back',text:'‹ '+t('back'),onclick:back||goBack}), el('h2',{class:'jp',text:title}) ]); }
function chipTab(label,on,fn){ const b=el('button',{class:'chip'+(on?' on':''),text:label}); b.addEventListener('click',fn); return b; }
function rowBtn(main,cnt,fn){ const b=el('button',{class:'listrow'},[ el('span',{class:'main jp',style:'font-weight:600',text:main}), el('span',{class:'cnt',text:cnt}) ]); b.addEventListener('click',fn); return b; }

/* ---------- chrome wiring: help / io / lang / brand / course ---------- */
function wireChrome(){
  document.getElementById('langJa').addEventListener('click',()=>setLang('ja'));
  document.getElementById('langZh').addEventListener('click',()=>setLang('zh'));
  document.getElementById('helpBtn').addEventListener('click',openHelp);
  document.getElementById('brandBtn').addEventListener('click',()=>{ if(App.idx) goHome(); });
  document.getElementById('devBtn').addEventListener('click',openDev);
  document.getElementById('courseBtn').addEventListener('click',openCourseSwitch);
  document.getElementById('setBtn').addEventListener('click',openSettings);
  var _vb=document.getElementById('verBadge'); if(_vb) _vb.addEventListener('click',openUpdates); /* 版本 chip 已移出顶栏；更新履歴入口在设置 */
  refreshChrome();
}
function rerenderCurrent(){ // re-render the current view in place (preserve sub-state); fixes lang-switch jumping home
  if(!App.idx) return;
  if(App.session && document.querySelector('.runner')){ renderRunner(); return; }
  if(typeof currentView==='function'){ currentView(); return; }
  renderHome();
}

/* modal infra */
let modalOpener=null;
function openModal(node){
  const root=document.getElementById('modalRoot');
  const prev=root.firstElementChild;
  if(prev && !prev.__inertPopped){ prev.__inertPopped=true; setBackdropInert(false); } // F4: closeModal を経ずに差し替えられる開き直しでも棧を漏らさない
  root.innerHTML='';
  modalOpener=document.activeElement;                       /* B2: 閉じたら元の場所へ帰す */
  const m=el('div',{class:'modal',onclick:function(e){ if(e.target===m) closeModal(); }},[ node ]);
  const card=node&&node.classList&&node.classList.contains('modal-in')?node:(node?node.querySelector&&node.querySelector('.modal-in'):null);
  if(card){
    card.setAttribute('role','dialog'); card.setAttribute('aria-modal','true'); card.setAttribute('tabindex','-1');
    const h=card.querySelector('h3,h2,.mtitle');
    if(h){ if(!h.id) h.id='modalTitle_'+Date.now(); card.setAttribute('aria-labelledby',h.id); }
  }
  root.appendChild(m);
  m.__inertPopped=false; setBackdropInert(true,[root]); trapFocus(m); // F4: 背景を inert+aria-hidden で封鎖し, Tab をモーダル内で循環 — 真のフォーカス境界
  setTimeout(function(){ try{ (card||m).focus(); }catch(e){} },0);   /* 開いたらフォーカスを中へ */
}
function closeModal(){
  const root=document.getElementById('modalRoot'); const m=root.firstElementChild;
  if(!m) return;
  if(!m.__inertPopped){ m.__inertPopped=true; setBackdropInert(false); } // F4: 一度きりの巻き戻し (reduced-motion 早退・closing 二重呼びの両方に安全)
  const back=modalOpener; modalOpener=null;
  setTimeout(function(){ try{ if(back&&back.isConnected&&back.focus) back.focus(); }catch(e){} },0);   /* B2: フォーカス復帰 */
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){ root.innerHTML=''; return; }
  if(m.classList.contains('closing')) return; // 已在退场
  m.classList.add('closing');
  let done=false;
  const fin=function(){ if(done) return; done=true; if(m.parentNode) m.parentNode.removeChild(m); }; // 只移除本浮层, 避免误删随后重开的浮层
  const card=m.querySelector('.modal-in')||m;
  card.addEventListener('animationend', fin, {once:true});
  setTimeout(fin, 500); // 兜底: animationend 不触发也必清
}
function modalShell(title,body){ const inner=el('div',{class:'modal-in'},[ el('button',{class:'modal-x',text:'×','aria-label':t('close'),onclick:closeModal}), el('h3',{class:'jp',text:title}) ]); (Array.isArray(body)?body:[body]).forEach(b=>inner.appendChild(b)); return inner; } // F-08: ×に読み上げ名

/* 神経の「使い方」。臨床(問題を解く道具)とは使い方そのものが違うので、説明も別に書く。
 * 臨床の文面をそのまま出すと「模擬試験」「苦手を重点的に」など、この課には無い機能の話になる。 */
function helpSecsNeuro(){
  const ja=App.lang==='ja';
  const nq=(App.questions||[]).length;   /* B6: 問題数を直書きすると、増題した瞬間に説明書が嘘をつく */
  if(!ja) return [
    {ic:'book',t:'先读，再查',h:'这门课的主体是<b>读</b>和<b>查</b>，不是刷题（全课只有 '+nq+' 道练习题）。首页的「回」进去就是笔记：每一回按 <b>测量法 → 信号・指标 → 心理机能</b> 的脉络重排过，一个术语一张卡，定义、要点、图、对比表都在一起。'},
    {ic:'search',t:'怎么查得到',h:'首页最上面的检索框：<b>汉字、假名、别名、缩写都行</b>（打 しさいぼう 能查到「視細胞」，打 EDA 能查到「皮膚電気活動」）。片假名/平假名、全角/半角一视同仁。<b>空格分隔＝同时包含</b>。检索还会翻正文、对比表和讲义注意，点结果直接落到笔记里那一段。'},
    {ic:'weakwrong',t:'考前先看这里',h:'首页的「<b>レジュメ注意</b>」是讲义写错、照抄会吃亏的 4 处——先给定论，再保留讲义原话，考试该怎么答也写清楚了。另外，课上被点名强调过的地方（22 处）会直接出现在对应术语的卡片里。'},
    {ic:'cards',t:'对比表和图',h:'易混概念做成了对比表（35 张），同一组用同一套比较轴。波形和分布类的图是重新画的（活动电位、脑波5帯域、加算平均、N170 等）；解剖图不重画（避免画错），直接<b>取自讲义那一页</b>，点右下角可放大。重画的图下面有一个入口，看不明白时能拉出讲义原来那一页。'},
    {ic:'gear',t:'数据与语言',h:'进度只存在这台设备上，不上传。右上角可随时切换日文／中文。两门课的进度互相隔离，切课不会互相污染。'}
  ];
  return [
    {ic:'book',t:'まず読む、そして引く',h:'この課の主役は<b>読む</b>ことと<b>さがす</b>こと。問題は全部で '+nq+' 問しかありません。ホームの「回」から入ると、そのままノートになっています。各回は <b>測定法 → 信号・指標 → 心理機能</b> の流れで並べ直してあり、用語ひとつにつき 1 枚。定義・要点・図・対比表がその場に揃っています。'},
    {ic:'search',t:'引き方',h:'ホーム上の検索窓には <b>漢字・かな・別名・略語</b>のどれを打っても届きます（「しさいぼう」で 視細胞、「EDA」で 皮膚電気活動）。カタカナとひらがな、全角と半角は同じものとして扱います。<b>スペースで区切ると「どれも含む」</b>で絞れます。本文・対比表・レジュメ注意まで探しにいくので、結果を押せばノートのその段落に着きます。'},
    {ic:'weakwrong',t:'試験前はここから',h:'ホームの「<b>レジュメ注意</b>」はレジュメの記述が誤っている 4 件で、定説・レジュメの字面・試験でどう答えるかを並べてあります。授業で念を押された箇所（22 件）は、その用語のカードの中に出てきます。'},
    {ic:'cards',t:'対比表と図',h:'まぎらわしい概念は対比表(35 枚)にしてあり、同じ組は同じ軸で比べます。波形や分布の図(活動電位・脳波の5帯域・加算平均・N170 など)は描き起こしたものです。解剖図は描き起こすと不正確になりうるので、<b>レジュメのそのページをそのまま</b>載せ、右下で拡大できます。描き起こした図には、分かりにくいときにレジュメの元のページを開けるボタンを添えてあります。'},
    {ic:'gear',t:'データと言語',h:'進みぐあいはこの端末にだけ保存され、どこにも送られません。日本語／中国語は右上でいつでも切り替えられます。2 つの課の進捗はそれぞれ別に保たれるので、混ざりません。'}
  ];
}
function openHelp(){
  const ic={ exam:ICONS.exam, wrong:ICONS.wrong, weakwrong:NEW_ICONS.weakwrong, cards:NEW_ICONS.cards, book:NEW_ICONS.book, gear:NEW_ICONS.gear,
    search:NEW_ICONS.search,
    kbd:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>' };
  const body=[];
  const secs=(App.course&&App.course.shape==='reader') ? helpSecsNeuro() : (t('helpSecs')||[]);
  secs.forEach(function(sec){
    body.push(el('div',{class:'helpsec'},[
      el('h4',{class:'jp'},[ el('span',{class:'hc',html:ic[sec.ic]||ic.gear}), document.createTextNode(sec.t) ]),
      el('p',{class:'jp',html:sec.h})
    ]));
  });
  body.push(el('div',{class:'fbkcontact jp',style:'margin-top:6px',text:t('feedback')}));
  openModal(modalShell(t('helpTitle'),body));
}

function ioBlock(withReset){ withReset=(withReset!==false); // v1.3.1 抽出复用(设置面板 & 结果页 IO modal 共用); §5-5: 設定パネルは false で reset を末尾の独立ブロックに分離
  const includeChk=el('input',{type:'checkbox'});
  const arr=[
    el('p',{class:'muted jp',text:t('ioNote')}),
    el('label',{class:'checkline'},[ includeChk, document.createTextNode(t('includeRaw')) ]),
    el('div',{class:'row'},[
      el('button',{class:'btn',text:t('export'),onclick:()=>doExport(includeChk.checked)}),
      (function(){ // F8: display:none の file input を包む label は Tab 順に乗らない → 本物の button から .click() で開く
        const inp=el('input',{type:'file',accept:'application/json,.json',style:'display:none'}); inp.addEventListener('change',doImport);
        const btn=el('button',{type:'button',class:'btn ghost',text:t('importBtn'),onclick:function(){ inp.value=''; inp.click(); }}); // value='' で同一ファイルの再取込も change が飛ぶ
        return el('span',{style:'display:contents'},[ btn, inp ]); })()
    ])
  ];
  if(lsGet(nk('importBackup'),null)){ // F-02: 直前の取り込みが戻せる間だけ出す
    arr.push(el('button',{class:'btn ghost sm',style:'margin-top:8px',text:t('impUndo'),onclick:undoImport}));
  }
  if(withReset){ arr.push(
    el('hr',{style:'border:none;border-top:1px dashed var(--line);margin:16px 0'}),
    el('div',{class:'rubt jp',text:t('resetTitle')}),
    el('div',{class:'row'},[ // F-02: 二段リセット（軽=進捗のみ／重=全ローカルデータ、文案どおり）
      el('button',{class:'btn ghost',text:t('resetProg'),onclick:doResetProgress}),
      el('button',{class:'btn ghost',style:'border-color:var(--no-line);color:var(--no-deep)',text:t('reset'),onclick:doReset})
    ])
  ); }
  return arr;
}
function openIO(){ openModal(modalShell(t('ioTitle'),ioBlock())); }
/* ---------- F-02: 完全バックアップ v2（データ字典＝課の名前空間の全鍵） ---------- */
const COURSE_KEYS=['progress','examInProgress','helpSeen','lastRead','readerFs','readerBm','examDate','bookmarks','examHistory'];
const EXTRA_SPEC={ // 取り込み時の型白名单（progress は engine の deserialize が別途厳格処理）
  examInProgress:function(v){ return v===null||typeof v==='object'; },
  helpSeen:function(v){ return typeof v==='boolean'; },
  lastRead:function(v){ return v&&typeof v==='object'&&typeof v.kai==='number'; },
  readerFs:function(v){ return typeof v==='number'||typeof v==='string'; },
  readerBm:function(v){ return Array.isArray(v)&&v.every(function(x){return typeof x==='string';}); },
  examDate:function(v){ return typeof v==='string'&&v.length<40; },
  bookmarks:function(v){ return Array.isArray(v)&&v.every(function(x){return typeof x==='string';}); },
  examHistory:function(v){ return Array.isArray(v)&&v.every(function(x){return x&&typeof x==='object';}); }
};
function exportPayload(includeRaw){
  return C.serializeProgress(App.progress,{courseId:App.course.id,schemaVersion:PROGRESS_SCHEMA,appVersion:APP_VERSION},{includeRawAnswers:includeRaw});
}
function buildExportV2(includeRaw){ // v1 本体＋extras 全鍵＝完全バックアップ（v1 読み手とも互換）
  const payload=exportPayload(includeRaw);
  payload.exportSchema=2;
  payload.exportedAt=new Date().toISOString();
  payload.extras={};
  Object.keys(EXTRA_SPEC).forEach(function(k){
    const v=lsGet(nk(k),null);
    if(v!==null) payload.extras[k]=v;
  });
  return payload;
}
function applyImportPayload(obj){ // 検証→自動バックアップ→適用→失敗時ロールバック。戻り値＝適用摘要
  const parsed=C.deserializeProgress(obj);
  const rawBackup={};
  COURSE_KEYS.forEach(function(k){ rawBackup[k]=localStorage.getItem(nk(k)); });
  lsSet(nk('importBackup'),{at:new Date().toISOString(),data:rawBackup});
  const applied=[],skipped=[];
  try{
    App.progress=Object.assign(emptyProgress(),parsed.progress,{schemaVersion:PROGRESS_SCHEMA});
    App.progress.cardMarks=(obj&&obj.cardMarks)||{}; App.progress.hideLearned=!!(obj&&obj.hideLearned);
    saveProgress(); applied.push('progress');
    if(obj.exportSchema>=2 && obj.extras && typeof obj.extras==='object'){
      Object.keys(EXTRA_SPEC).forEach(function(k){
        if(!(k in obj.extras)) return;
        const v=obj.extras[k];
        if(EXTRA_SPEC[k](v)){ lsSet(nk(k),v); applied.push(k); }
        else skipped.push(k);
      });
    }
  }catch(err){ // ロールバック: バックアップ原値を書き戻す
    COURSE_KEYS.forEach(function(k){
      if(rawBackup[k]===null) localStorage.removeItem(nk(k));
      else localStorage.setItem(nk(k),rawBackup[k]);
    });
    loadProgress();
    throw err;
  }
  return {applied:applied,skipped:skipped};
}
function undoImport(){ // 直前の取り込みを 1 段だけ戻す
  const b=lsGet(nk('importBackup'),null);
  if(!b||!b.data){ alert(t('impNoBackup')); return; }
  COURSE_KEYS.forEach(function(k){
    if(b.data[k]===null||b.data[k]===undefined) localStorage.removeItem(nk(k));
    else localStorage.setItem(nk(k),b.data[k]);
  });
  lsDel(nk('importBackup'));
  location.reload();
}
function buildExportAIPrompt(){
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
  // 薄弱概念(高频在前)也并入材料范围
  Object.entries(App.progress.weakness||{}).sort(function(a,b){return b[1]-a[1];}).forEach(function(p){ conSet.add(p[0]); });
  const kais=Array.from(kaiSet).sort(function(a,b){return a-b;});
  const sections=Array.from(secSet).sort();
  const concepts=Array.from(conSet).slice(0,40);
  const sep='、';
  const subj=(App.course&&App.course.subject)?L(App.course.subject):L(App.course?App.course.title:{ja:'',zh:''});
  const lines=[ t('aiExpRole').replace('{subject}',subj), '', t('aiExpTask') ];  /* v1.7.0: 学科名を直書きしていた(2門目で誤った役割) */
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
  const payload=buildExportV2(includeRaw); // F-02: v2＝全鍵同梱
  // 顶部嵌入説明(随语言)
  payload._説明 = App.lang==='ja'
    ? 'これは『'+L(App.course.title)+'』復習ドリルの学習データです。用途は ①バックアップ ②端末間の手動移行 ③AIに渡して復習計画を作る、の3つ。個人を特定する情報・端末情報は含みません。'+(includeRaw?'※手書き解答を含むため共有時は注意。':'手書き解答は既定で除外しています。')
    : '这是《'+L(App.course.title)+'》复习刷题工具的学习数据。用途有三：①备份 ②设备间手动迁移 ③交给 AI 排复习计划。不含可识别个人的信息或设备信息。'+(includeRaw?'※含手写答案，分享时请注意。':'手写答案默认已排除。');
  // AI 提示词 + 自动材料清单(随当前语言)。把这段连同数据一起喂给 AI 即可。
  const ai=buildExportAIPrompt();
  payload.aiPrompt=ai.prompt;
  payload.materials=ai.materials;
  payload.cardMarks=App.progress.cardMarks||{}; payload.hideLearned=!!App.progress.hideLearned; // §5-11: serializeProgress は固定 schema で含まない → 進捗として同梱
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='quiz-progress_'+App.course.id+'_'+new Date().toISOString().slice(0,10)+'.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function doImport(e){ // F-02: 解析→検証→プレビュー確認→自動バックアップ付き適用
  const file=e.target.files[0]; if(!file) return;
  e.target.value='';
  if(file.size>8*1024*1024){ alert(t('impSizeErr')); return; }
  const reader=new FileReader();
  reader.onload=function(){
    try{
    const obj=JSON.parse(reader.result);
    const parsed=C.deserializeProgress(obj);
    const ex=obj.extras||{};
    const n=function(k){ return Array.isArray(ex[k])?ex[k].length:0; };
    const warn=[];
    if(parsed.courseId && parsed.courseId!==App.course.id) warn.push(t('impMismatch')+'（'+parsed.courseId+'）');
    if(parsed.schemaVersion!==PROGRESS_SCHEMA) warn.push(t('impSchemaDiff'));
    const rows=[
      t('impCourse')+': '+(parsed.courseId||'?'),
      t('impDate')+': '+(obj.exportedAt||(obj.exportSchema>=2?'?':'v1（旧形式）')),
      t('impSeen')+': '+Object.keys(parsed.progress.seen||{}).length+' / '+t('impWrong')+': '+Object.keys(parsed.progress.wrong||{}).length,
      t('impExtras')+': '+(obj.exportSchema>=2?('examHistory '+n('examHistory')+'・bookmarks '+n('bookmarks')+'・readerBm '+n('readerBm')):t('impExtrasNone'))
    ];
    openModal(modalShell(t('impTitle'),[ // modalShell は null 子を受けない → filter(Boolean)
      el('div',{class:'jp'},rows.map(function(r){ return el('p',{class:'muted',style:'margin:4px 0',text:r}); })),
      warn.length?el('p',{class:'jp',style:'color:var(--no-deep);background:var(--no-wash);border:1px solid var(--no-line);border-radius:8px;padding:8px 10px',text:'⚠ '+warn.join(' / ')}):null,
      el('p',{class:'muted jp',style:'font-size:12px',text:t('impBackupNote')}),
      el('div',{class:'row',style:'margin-top:10px'},[
        el('button',{class:'btn',text:t('impApply'),onclick:function(){
          try{ applyImportPayload(obj); closeModal(); location.reload(); }
          catch(err){ alert(t('impBadFile')+': '+err.message); }
        }}),
        el('button',{class:'btn ghost',text:t('impCancel'),onclick:closeModal})
      ])
    ].filter(Boolean)));
    }catch(err){ alert(t('impBadFile')+': '+err.message); }
  };
  reader.readAsText(file);
}
function doResetProgress(){ // F-02: 二段リセットの軽い方＝学習進捗のみ
  if(!confirm(t('resetProgConfirm'))) return;
  App.progress=emptyProgress(); saveProgress(); lsDel(nk('examInProgress')); closeModal(); renderHome();
}
function doReset(){ // F-02: 重い方＝この課の端末内データ全消去（文案どおりに動く）
  if(!confirm(t('resetConfirm'))) return;
  COURSE_KEYS.forEach(function(k){ lsDel(nk(k)); });
  lsDel(nk('importBackup'));
  location.reload();
}
function showMigrationModal(){
  if(!pendingMigration) return;
  openModal(modalShell(App.lang==='ja'?'進捗データの形式が更新されました':'进度数据格式已更新',[
    el('p',{class:'muted jp',text:App.lang==='ja'?'以前の進捗が見つかりましたが、形式が新しくなっています。安全のため、まず現在の進捗を書き出してから移行できます（自動では消しません）。':'检测到旧版进度，但格式已更新。为安全起见，可先导出当前进度再迁移（不会自动清除）。'}),
    el('div',{class:'row'},[
      el('button',{class:'btn',text:App.lang==='ja'?'古い進捗を書き出す':'导出旧进度',onclick:function(){ const blob=new Blob([JSON.stringify(pendingMigration,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='old-progress_'+App.course.id+'.json'; a.click(); }}),
      el('button',{class:'btn ghost',text:App.lang==='ja'?'新形式で続ける':'用新格式继续',onclick:function(){ pendingMigration=null; saveProgress(); closeModal(); }})
    ])
  ]));
}
/* ===================== コース切替(様例先行門・4案を実切替可) =====================
 * ?sw=A 常設chip+モーダル / ?sw=B ホーム上部のセグメント / ?sw=C ダッシュボード / ?sw=D chip+ドロップダウン
 * 旧実装は「listrow に course.id を右端表示」するだけのモーダルで、現在どのコースに
 * 居るのかも、切替先に何があるのかも分からなかった。 */
function courseList(){ return (App.manifest&&App.manifest.courses)||[]; }
function courseStat(c){
  /* 課ごとの進捗は quiz:<id>:progress に隔離されている。切替前に「向こうの状況」を出すため、
   * 課を読み込まずに localStorage だけ覗く(軽い)。 */
  const ja=App.lang==='ja';
  let seen=0;
  try{ const p=JSON.parse(localStorage.getItem('quiz:'+c.id+':progress')||'null'); if(p&&p.seen) seen=Object.keys(p.seen).length; }catch(e){}
  const total=(c.exam&&c.exam.total)||0;
  const cur=App.course&&App.course.id===c.id;
  return {seen:seen, total:total, cur:cur,
    line:(c.shape==='reader')?(ja?('読む・さがす · 練習問題 '+total+' 問'):('通读・检索 · 练习题 '+total+' 题'))
                             :(ja?('試験 '+total+' 問 · 解いた '+seen):('考试 '+total+' 题 · 已做 '+seen))};
}
/* コース切替の専用転場。行き先の課の肌色でヴェールを敷き、その下で loadCourse し、
 * ヴェールが引くのと同時に新ホームが立ち上がる。after は「切替と同時に行き先まで」用。 */
async function enterCourse(c, after){
  closeModal();
  const same = App.course && App.course.id===c.id;
  if(same){ if(after) after(); return; }
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sk=c.skin||{};
  const veil=el('div',{class:'course-veil'});
  veil.style.setProperty('--cv-accent',(sk['--accent-wash']||sk['--accent']||'var(--accent-wash)'));
  veil.style.setProperty('--cv-wash',(sk['--accent-wash']||'var(--accent-wash)'));
  veil.style.setProperty('--cv-paper',(sk['--paper']||'var(--paper)'));
  veil.style.setProperty('--cv-card',(sk['--card2']||sk['--paper']||'var(--card)'));
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
function closeCoursePop(restoreFocus){ const o=document.getElementById('cpop'); if(o) o.remove(); const cb=document.getElementById('courseBtn'); if(cb){ cb.setAttribute('aria-expanded','false'); if(restoreFocus) cb.focus(); } } // F10: 閉路は全てここに集約=aria-expanded の戻し忘れなし。F-03: Escape 閉路は焦点を釦へ返す
function openCoursePop(kids,cls){
  closeCoursePop();
  const pop=el('div',{class:'cpop '+(cls||''),id:'cpop',role:'dialog','aria-label':t('coursePop')},kids);
  document.body.appendChild(pop);
  const cb=document.getElementById('courseBtn'); if(cb) cb.setAttribute('aria-expanded','true'); // F10: 開閉状態を晒す (aria-controls=cpop は静的標記側)
  trapFocus(pop); // F-03: Tab/Shift+Tab は浮き内で循環
  pop.addEventListener('keydown',function(e){ // F-03: Escape=閉じて呼び出し元へ・↑↓=項目間移動
    if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); closeCoursePop(true); return; }
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      const f=Array.prototype.filter.call(pop.querySelectorAll(FOCUSABLE),function(x){ return x.offsetParent!==null; });
      if(!f.length) return;
      let i=f.indexOf(document.activeElement);
      i=(e.key==='ArrowDown')?(i+1)%f.length:(i-1+f.length)%f.length;
      f[i].focus(); e.preventDefault();
    }
  });
  const first=pop.querySelector(FOCUSABLE); if(first) first.focus(); // F-03: 開いたら焦点は浮きの先頭へ
  setTimeout(function(){
    document.addEventListener('click',function h(e){
      if(!pop.contains(e.target) && !e.target.closest('#courseBtn')){ closeCoursePop(); document.removeEventListener('click',h); }
    });
  },0);
  return pop;
}
/* topbar 直下の浮き。切替と同時に「向こうで何をするか」まで選べるので、行き先が決まっていれば 1 手で着く。 */
function openCourseSwitch(){
  if(document.getElementById('cpop')){ closeCoursePop(); return; }
  openCoursePop(courseMenuRows(),'wide');
}
function courseMenuRows(){
  const ja=App.lang==='ja';
  return courseList().map(function(c){
    const st=courseStat(c);
    const row=el('div',{class:'cm-i'+(st.cur?' on':'')},[
      el('button',{class:'cm-main',onclick:function(){ closeCoursePop(); switchTo(c); }},[
        el('span',{class:'cm-dot',style:'background:'+((c.skin&&c.skin['--accent'])||'var(--accent)')}),
        el('span',{class:'cm-tx'},[ el('b',{class:'jp',text:L(c.title)}), el('small',{class:'jp',text:st.line}) ]),
        st.cur?el('span',{class:'cm-ck',text:'✓'}):el('span',{class:'cm-ck',text:'›'})
      ])
    ]);
    const acts=el('div',{class:'cm-acts'});
    const go=function(fn){ return async function(){ closeCoursePop(); if(!st.cur){ await enterCourse(c, fn); } else { fn(); } }; };
    if(c.shape==='reader'){
      acts.appendChild(el('button',{class:'cm-a jp',text:ja?'さがす':'检索',onclick:go(function(){ renderSearch(''); })}));
      acts.appendChild(el('button',{class:'cm-a jp',text:ja?'読む':'读',onclick:go(function(){ readerDir='fwd'; const lr=lsGet(nk('lastRead'),null); renderReader(lr?lr.kai:1, lr?(lr.sec||0):0); })}));
    }else{
      acts.appendChild(el('button',{class:'cm-a jp',text:ja?'模擬試験':'模拟考',onclick:go(function(){ startExam(); })}));
      acts.appendChild(el('button',{class:'cm-a jp',text:ja?'ノート':'笔记',onclick:go(function(){ renderReaderIndex(); })}));
    }
    row.appendChild(acts);
    return row;
  });
}

/* ---------- copy helper ---------- */
function copyText(text,btn){
  function ok(){ if(btn){ const o=btn.textContent; btn.textContent=t('copied'); setTimeout(()=>btn.textContent=o,1400); } }
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(ok,()=>fallback()); } else fallback();
  function fallback(){ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');ok();}catch(e){} ta.remove(); }
}

/* ---------- error boundary + dev ---------- */
let lastError=null;
function installErrorBoundary(){
  window.addEventListener('error',function(e){ lastError={msg:e.message,stack:e.error&&e.error.stack,at:Date.now()}; });
  window.addEventListener('unhandledrejection',function(e){ lastError={msg:'unhandledrejection: '+(e.reason&&e.reason.message||e.reason),stack:e.reason&&e.reason.stack,at:Date.now()}; });
}
function openDev(){
  const v=App.validation||{errors:[],warnings:[],degraded:[],stats:{byKai:{},byType:{}},degeneracy:{}};
  const inner=el('div',{class:'dev-in'});
  inner.appendChild(el('button',{class:'modal-x',text:'×','aria-label':t('close'),onclick:closeDev})); // F-08
  inner.appendChild(el('h3',{text:'DEV · データ健康診断'}));
  inner.appendChild(el('div',{class:'muted',text:'course: '+(App.course?App.course.id:'-')+' · engine '+C.VERSION+' · app '+APP_VERSION}));
  // counts
  const counts=el('div',{class:'dev-sec'},[ el('h4',{text:'Loaded'}) ]);
  counts.appendChild(el('div',{text:'total: '+v.stats.total+'  ·  choice: '+(v.stats.byType.choice||0)+'  ·  subjective: '+(v.stats.byType.subjective||0)+'  ·  concepts: '+v.stats.conceptCount}));
  const kaiPills=el('div',{style:'margin-top:6px'}); App.idx.kais.forEach(k=>kaiPills.appendChild(el('span',{class:'pill2',text:'回'+k+':'+(v.stats.byKai[k]||0)})));
  counts.appendChild(kaiPills);
  if(v.stats.dupIds.length) counts.appendChild(el('div',{class:'devwarn',text:'dup ids: '+v.stats.dupIds.join(', ')}));
  inner.appendChild(counts);
  // validation
  const val=el('div',{class:'dev-sec'},[ el('h4',{text:'Validation'}) ]);
  val.appendChild(el('div',{class:v.errors.length?'devbad':'devok',text:'errors: '+v.errors.length}));
  v.errors.slice(0,40).forEach(e=>val.appendChild(el('div',{class:'devbad',text:'· ['+e.id+'] '+e.msg})));
  val.appendChild(el('div',{class:v.warnings.length?'devwarn':'devok',text:'warnings: '+v.warnings.length}));
  v.warnings.slice(0,30).forEach(e=>val.appendChild(el('div',{class:'devwarn',text:'· ['+e.id+'] '+e.msg})));
  val.appendChild(el('div',{style:'margin-top:6px',text:'graceful-degrade: '+v.degraded.length+' 件'}));
  v.degraded.slice(0,20).forEach(e=>val.appendChild(el('div',{class:'muted',style:'font-size:11px',text:'· ['+e.id+'] '+e.reason})));
  inner.appendChild(val);
  // degeneracy guard
  const deg=el('div',{class:'dev-sec'},[ el('h4',{text:'退化分布守卫 (correct-position / length)'}) ]);
  const tbl=el('table',{class:'devtable'});
  tbl.appendChild(el('tr',null,[ el('th',{text:'回'}),el('th',{text:'n'}),el('th',{text:'correct pos dist'}),el('th',{text:'correct len'}),el('th',{text:'distractor len'}),el('th',{text:'Δ'}),el('th',{text:'flags'}) ]));
  Object.keys(v.degeneracy).forEach(function(kai){ const d=v.degeneracy[kai];
    const posStr=Object.keys(d.posDist).map(i=>i+':'+d.posDist[i]).join(' ');
    const tr=el('tr',null,[ el('td',{text:'回'+kai}), el('td',{text:String(d.n)}), el('td',{text:posStr}),
      el('td',{text:d.correctAvgLen.toFixed(1)}), el('td',{text:d.distractorAvgLen.toFixed(1)}),
      el('td',{text:(d.lenDiff>=0?'+':'')+d.lenDiff.toFixed(1)}),
      el('td',{class:'flag',text:d.flags.join(' / ')}) ]);
    if(d.flags.length) tr.style.background='var(--no-wash)';
    tbl.appendChild(tr); });
  deg.appendChild(tbl);
  inner.appendChild(deg);
  // shuffle self-check
  const shf=el('div',{class:'dev-sec'},[ el('h4',{text:'乱序自检 (reshuffle)'}) ]);
  const sample=App.questions.find(q=>q.kai===10&&q.type==='choice')||App.questions.find(q=>q.type==='choice');
  const out=el('div',{class:'mono',style:'font-size:11px'});
  function drawShuffle(){ const ord=C.shuffleOptions(sample.options,App.rng); out.textContent=sample.id+' → '+ord.map((o,i)=>i+':'+(o.correct?'✔':'·')).join('  '); }
  drawShuffle();
  shf.appendChild(el('div',{class:'muted',style:'font-size:11px',text:'c10 是退化存储(correct 恒在 0)。每次乱序应把 ✔ 打散到不同位置：'}));
  shf.appendChild(out);
  shf.appendChild(el('button',{class:'btn sm',style:'margin-top:8px',text:'再シャッフル',onclick:drawShuffle}));
  inner.appendChild(shf);
  // diagnostics
  const dx=el('div',{class:'dev-sec'},[ el('h4',{text:'Diagnostics'}) ]);
  dx.appendChild(el('div',{class:'row'},[
    el('button',{class:'btn sm ghost',text:'診断情報をコピー',onclick:copyDiagnostics})
  ]));
  if(lastError) dx.appendChild(el('div',{class:'devbad',style:'margin-top:8px;white-space:pre-wrap',text:'last error: '+lastError.msg}));
  inner.appendChild(dx);

  const panel=el('div',{class:'devpanel',onclick:function(e){ if(e.target===panel) closeDev(); }},[ inner ]);
  const root=document.getElementById('modalRoot'); root.innerHTML=''; root.appendChild(panel);
}
function closeDev(){ document.getElementById('modalRoot').innerHTML=''; }
function copyDiagnostics(){
  const v=App.validation||{};
  const diag={ app:APP_VERSION, engine:C.VERSION, course:App.course&&App.course.id, lang:App.lang,
    mode:App.session&&App.session.mode, pos:App.session&&App.session.pos, qid:App.session&&App.session.list&&App.session.list[App.session.pos]&&App.session.list[App.session.pos].id,
    loaded:v.stats&&v.stats.total, errors:(v.errors||[]).length, warnings:(v.warnings||[]).length,
    degeneracyFlags:Object.keys(v.degeneracy||{}).filter(k=>v.degeneracy[k].flags.length).map(k=>'回'+k), lastError:lastError };
  copyText(JSON.stringify(diag,null,2));
  alert(App.lang==='ja'?'診断情報をクリップボードにコピーしました（送信はしません）。':'诊断信息已复制到剪贴板（不会发送）。');
}

/* ===================================================================
 * v1.1 网页轨 第1轮 ― 新增功能模块（dashboard B / countdown / 回map /
 * stats / flashcards / search / bookmarks / settings / care timer / viz）
 * 全部纯前端、localStorage、不碰 questions/concepts 内容、题型注册表分发。
 * =================================================================== */

/* ---------- course-specific presentation config ----------
 * v1.7.0: 回タイトル・章立ては course-manifest 駆動へ。
 * 旧版は KAI_TITLES / CHAPTERS を裸の回番号でキーにしたモジュール定数に持っていた。
 * 2 門目(神経)を足すと第1回が「臨床心理学とは」と表示される——エラーではなく
 * "それらしい誤り" が黙って出るので、最もたちが悪い。manifest に無い課は null に落として
 * manual の unit タイトルで補う(表示専用。判定には一切影響しない)。 */
function courseKaiTitles(){ return (App.course&&App.course.kaiTitles)||{}; }
function CHAPTERS_OF(){ return (App.course&&App.course.chapters)||[]; }
function kaiTitle(kai){ const o=courseKaiTitles()[String(kai)]; if(o) return L(o);
  if(App.manual&&App.manual.units){ const u=App.manual.units.find(function(x){ return x.kai===kai; }); if(u) return u.subtitle||u.title; }
  return null; }
/* 案B 到達度: 回ごとの topic 副題(manual unit の sections/lede 由来; canonical 只读、纯呈现) */
function kaiTopic(kai){ if(!(App.manual&&App.manual.units)) return null;
  const u=App.manual.units.find(function(x){ return x.kai===kai; }); if(!u) return null;
  const tt=kaiTitle(kai);
  if(u.sections&&u.sections.length){ const picks=u.sections.map(function(s){ return s.title; }).filter(function(x){ return x&&x!==tt; }).slice(0,2); if(picks.length) return picks.join('・'); }
  return u.lede? (u.lede.length>44?u.lede.slice(0,42)+'…':u.lede) : null; }
/* 案B 到達度: 章分组的回数区间标签(第a-b回) */
function kaiRangeLabel(kais){ if(!kais||!kais.length) return ''; const a=kais[0], b=kais[kais.length-1]; return a===b?('第'+a+'回'):('第'+a+'-'+b+'回'); }

/* ---------- settings: 利き手 / 試験日 ---------- */
function getHand(){ return lsGet('quiz:hand','right'); }
function setHand(h){ lsSet('quiz:hand',h); }
function getExamDate(){ return lsGet(nk('examDate'),null); }
function setExamDate(v){ if(v) lsSet(nk('examDate'),v); else lsDel(nk('examDate')); if(currentView===renderHome){ renderHome(); } } // 設定後に即再描画(以前はリロードしないとカウントダウンが出ない bug)
function daysUntilExam(){ const d=getExamDate(); if(!d) return null; const today=new Date(); today.setHours(0,0,0,0); const ex=new Date(d+'T00:00:00'); if(isNaN(ex)) return null; return Math.round((ex-today)/86400000); }
function suggestedPace(){ const left=daysUntilExam(); if(left==null||left<=0) return null; const total=App.questions.length; const seen=Object.keys(App.progress.seen||{}).length; const remain=Math.max(0,total-seen); return remain>0?Math.ceil(remain/left):0; }

/* ---------- bookmarks（书签题，存本机；星标在解说层切换） ---------- */
function getBookmarks(){ return lsGet(nk('bookmarks'),{}); }
function isBookmarked(id){ return !!getBookmarks()[id]; }
function toggleBookmark(id){ const b=getBookmarks(); if(b[id]) delete b[id]; else b[id]=true; lsSet(nk('bookmarks'),b); return !!b[id]; }
/* ---------- 模試結果の履歴（保存＋回看; 追加キー examHistory, PROGRESS 契約は不変更） ---------- */
function getExamHistory(){ return lsGet(nk('examHistory'),[]); }
function saveExamHistory(sess,agg){
  try{
    const answered=sess.list.length, correct=agg.totals.correct;
    const unc=sess.list.filter(function(q){ const st=sess.perItem[q.id]; return st&&st.uncertain; }).length;
    const h=getExamHistory();
    h.unshift({ at:Date.now(), total:sess.list.length, answered:answered, correct:correct,
      pct:answered?Math.round(correct/answered*100):0,
      wrongIds:(agg.wrongIds||[]).slice(0,200), unc:unc, ms:examElapsed() });
    if(h.length>60) h.length=60; // 上限: 期末運用に十分・localStorage を太らせない
    lsSet(nk('examHistory'),h);
  }catch(e){}
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
  card.appendChild(el('div',{class:'statgrid'},[ statBox(e.answered,App.lang==='ja'?'解答':'已答'), statBox(e.correct,t('correct')), statBox(e.wrongIds.length,t('wrong')) ]));
  card.appendChild(el('div',{class:'examtime jp',text:t('examTime')+'　'+fmtDuration(e.ms/1000)}));
  if(e.wrongIds.length){
    card.appendChild(el('div',{class:'rubt jp',style:'margin-top:12px',text:t('subWrong')}));
    e.wrongIds.forEach(function(id){ const q=App.idx.byId[id]; if(!q) return;
      card.appendChild(el('button',{class:'listrow',onclick:function(){ startPracticeIds([id]); }},[
        el('span',{class:'lead',text:'回'+q.kai}),
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
  if(left.length){ let a=0,c=0; left.forEach(function(k){ a+=ks[k].answered; c+=ks[k].correct; }); rows.push({label:App.lang==='ja'?'その他':'其他',answered:a,correct:c,acc:a?c/a:null}); }
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

/* ---------- SVG helpers ---------- */
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

/* ---------- viz A: donut(正答率) + 概念ランキング(误答数/答过 ・ %) ---------- */
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
      el('span',{class:'rk-v',html:s.answered?(s.wrong+'/'+s.answered+' ・ <b>'+Math.round(s.rate*100)+'%</b>'):'-'})
    ]);
    list.appendChild(row);
  });
  wrap.appendChild(list);
  return wrap;
}

/* ===================== DASHBOARD B node builders ===================== */
function searchBarNode(){
  const box=el('button',{type:'button',class:'searchbar',onclick:function(){ renderSearch(''); }},[ // F2: 検索の主入口 — 本物の button で Tab/Enter/Space と読み上げ名(中身の文言)を確保
    el('span',{class:'svgwrap','aria-hidden':'true',html:NEW_ICONS.search}),
    el('span',{class:'sbph jp',text:t('searchPh')})
  ]);
  return box;
}
function statCapNode(){ // StatusCard: 倒计时 + 线性进度条（实绑真数 total=App.questions.length）
  const cap=el('div',{class:'stc'}); // 倒計時は greetsub(挨拶直下)へ移設 → ここは進捗カードのみ
  const solved=Object.keys(App.progress.seen||{}).length, total=App.questions.length;
  const pct=total?Math.round(solved/total*100):0, ja=App.lang==='ja';
  cap.appendChild(el('div',{class:'stc-pr'},[
    el('div',{class:'prh'},[ el('span',{class:'prl',text:ja?'解答の進みぐあい':'解答进度'}), el('span',{class:'prn',text:solved+' / '+total}) ]),
    el('div',{class:'prbar'},[ el('i',{style:'width:'+pct+'%'+(pct>0?';min-width:10px':'')}) ]),
    el('div',{class:'prf'},[ el('span',{class:'prp',text:pct+'% '+(ja?'達成':'达成')}), el('span',{class:'prr',text:ja?('のこり '+(total-solved)+' 問'):('剩余 '+(total-solved)+' 题')}) ])
  ]));
  return cap;
}
/* ---------- 復習トラック 1b home shell builders ---------- */
function homeHeroNode(hasExam){
  // V1 版面: 挨拶が主役 → 直下に試験日ライン(タップで設定へ) → 演習/復習ピル; 右列は進捗カードのみ
  const left=daysUntilExam(), pace=suggestedPace();
  let subHtml;
  if(left!=null&&left>0){ subHtml=t('examIn').replace('{n}','<b>'+left+'</b>')+(pace?('・'+t('pace').replace('{n}','<b>'+pace+'</b>')):''); }
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
    return el('button',{class:'hsw-b','data-tab':tab,onclick:function(){ switchHomeTab(tab); }},[
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
  const sw=document.querySelector('.hsw'); if(sw) sw.setAttribute('data-active',tab);
  const tc=document.getElementById('homeTabContent');
  if(!tc){ renderHome(); return; }
  const next=(tab==='review') ? reviewTabNode(examResumable()) : examTabNode(examResumable());
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
function flagNode(o){ // V1 hero 解剖: pill → 大見出し(丸ゴ900) → 説明 → 全幅ピルCTA → 続行チップ
  const card=el('div',{class:'flag'},[
    el('span',{class:'fpill',text:o.pill}),
    el('div',{class:'fti jp',text:o.title}),
    el('div',{class:'fde jp',text:o.desc}),
    el('button',{class:'fcta jp',onclick:o.onCta},[ document.createTextNode(o.cta+' '), el('span',{style:'font-size:16px',text:'›'}) ])
  ]);
  if(o.chip) card.appendChild(el('div',{class:'ffoot'},[ o.onChip ? el('button',{class:'fchip fchip-btn jp',onclick:o.onChip,text:o.chip}) : el('span',{class:'fchip jp',text:o.chip}) ]));
  return card;
}
function examTabNode(hasExam){
  const kids=[ flagNode({icon:'exam',pill:t('flagExamPill'),title:t('actExam'),desc:t('actExamD'),cta:t('flagExamCta'),onCta:startExam,chip:hasExam?t('glanceContinue'):null,onChip:hasExam?resumeExam:null}) ]; // 中断続行は資料集と同じ chip 方式で CTA 直下へ統合(独立 resbar 廃止)
  kids.push(el('div',{class:'subrow'},[ el('button',{class:'subcard',onclick:renderExamHistory},[ el('span',{class:'scic',html:NEW_ICONS.clock}), el('span',{class:'sctx'},[ el('b',{text:t('histTitle')}), el('small',{class:'jp',text:t('histSub')}) ]) ]), el('button',{class:'subcard',onclick:renderQuestionMarks},[ el('span',{class:'scic',html:NEW_ICONS.star}), el('span',{class:'sctx'},[ el('b',{text:t('subMarked')}), el('small',{class:'jp',text:t('subMarkedD')}) ]) ]) ]));
  kids.push(rangePanelNode());
  return el('div',null,kids);
}
function reviewTabNode(hasExam){
  const lr=App.course?lsGet(nk('lastRead'),null):null;
  const ck=(lr&&lr.kai)?lr.kai:12, cs=(lr&&lr.sec)?lr.sec:0, ct=kaiTitle(ck), jaR=App.lang==='ja';
  const chipTxt=(lr?(jaR?'続き · 第':'继续 · 第'):'第')+ck+'回 '+(ct||''); // 白框chip=続読/注目回, 直接開く
  const flag=flagNode({icon:'book',pill:t('flagManualPill'),title:t('actManual'),desc:t('flagManualD2'),cta:t('flagManualCta'),onCta:function(){ renderReaderIndex(); },chip:lr?chipTxt:null,onChip:lr?function(){ renderReader(ck,cs); }:null}); // 赤框CTA=資料集ホーム(回一覧); 続き chip 仅在有 lastRead 记录时显示(同续考 hasExam 条件, 无记录不显示默认回 — bug fix)
  const subs=el('div',{class:'subrow'},[
    el('button',{class:'subcard',onclick:renderFlashcards},[ el('span',{class:'scic',html:NEW_ICONS.cards}), el('span',{class:'sctx'},[ el('b',{text:t('subCards')}), el('small',{class:'jp',text:t('subCardsD')}) ]) ]),
    el('button',{class:'subcard',onclick:renderReaderMarks},[ el('span',{class:'scic',html:NEW_ICONS.book}), el('span',{class:'sctx'},[ el('b',{text:t('subBook')}), el('small',{class:'jp',text:t('subBookD')}) ]) ])
  ]);
  return el('div',null,[ flag, subs, lookbackNode() ]);
}
function lookbackNode(){ // 学習の振り返り: 分野別 | 今週+苦手トップ + 演習への橋渡し(ShellSeg §5.3)
  const ja=App.lang==='ja';
  const panel=el('div',{class:'spanel'},[ el('div',{class:'sph'},[ el('b',{text:t('lookbackTitle')}), el('small',{class:'jp',text:t('lookbackSub')}) ]) ]);
  const L1=el('div',null,[ el('div',{class:'lookh',text:t('lookField')}) ]);
  const rows=chapterStats();
  if(rows.length && rows.some(function(r){return r.answered>0;})){
    rows.forEach(function(r){ const has=r.acc!=null;
      L1.appendChild(el('div',{class:'chrow2'},[
        el('div',{class:'chn jp',text:r.label}),
        el('div',{class:'chb'},[ el('i',{style:'width:'+(has?Math.round(r.acc*100):0)+'%'}) ]),
        el('div',{class:'chv',text:has?Math.round(r.acc*100)+'%':t('untouchedShort')})
      ]));
    });
  } else { L1.appendChild(el('div',{class:'gnone jp',style:'padding:6px 0',text:t('lookbackEmpty')})); }
  const R1=el('div',null,[ el('div',{class:'lookh',text:t('lookWeekTop')}) ]);
  const wa=weekActivity(), mx=Math.max.apply(null,wa.days.map(function(d){return d.n;}).concat([1]));
  const wrow=el('div',{class:'weekrow'});
  wa.days.forEach(function(d){ wrow.appendChild(el('i',{style:'height:'+Math.max(8,Math.round(d.n/mx*100))+'%;opacity:'+(d.n===0?0.32:1)})); });
  R1.appendChild(wrow);
  R1.appendChild(el('div',{class:'weekn jp',html:t('lookWeekN')+' <b>'+wa.total+'</b> '+(ja?'問':'题')}));
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
  function mkTile(k){ const s=ks[k], title=kaiTitle(k), topic=kaiTopic(k), has=s.acc!=null;
    return el('button',{class:'kt',onclick:function(){ startReviewKai(k); }},[
      el('div',{class:'kh'},[ el('span',{class:'kn',text:'第'+k+'回'}), el('span',{class:'kb '+(has?'done':'todo'),text:has?Math.round(s.acc*100)+'%':t('untouched')}) ]),
      el('div',{class:'ktt jp',text:title||'',title:title||''}),
      topic? el('div',{class:'ktopic jp',text:topic,title:topic}) : null,
      el('div',{class:'ktb'},[ el('i',{style:'width:'+Math.round(s.cov*100)+'%'}) ])
    ]);
  }
  /* 案B: 到達度按 CHAPTERS 分组(章扉感)+每章一 rmap 子网格; 表外回落 その他 */
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
    groups.appendChild(el('div',{class:'rchap'},[ el('div',{class:'rchaphd'},[ el('span',{class:'rchapname jp',text:App.lang==='ja'?'その他':'其他'}) ]), sub ])); }
  return el('div',{class:'spanel',id:'reviewHub'},[
    el('div',{class:'sph'},[ el('b',{text:t('rangeTitle')}), el('small',{class:'jp',text:t('rangeSub')}) ]),
    el('div',{class:'splede jp',text:t('rangeLede')}),
    el('div',{class:'rtiles'},[
      el('button',{class:'rtile',onclick:startRandom},[ el('span',{class:'rtic',html:NEW_ICONS.refresh}), el('span',{class:'rtx'},[ el('b',{class:'jp',text:t('randTile')}), el('small',{class:'jp',text:t('randTileD')}) ]) ]),
      el('button',{class:'rtile',onclick:renderWrongList},[ el('span',{class:'rtic',html:NEW_ICONS.bars}), el('span',{class:'rtx'},[ el('b',{class:'jp',text:t('weakTile')}), el('small',{class:'jp',text:t('weakTileD')}) ]) ])
    ]),
    el('div',{class:'rmaphd'},[ el('span',{class:'mhic',html:NEW_ICONS.grid}), el('b',{class:'jp',text:t('kaiReachLabel')}), el('small',{class:'jp',text:t('kaiReachSub')}) ]),
    groups
  ]);
}
function reviewPanelNode(){
  const panel=el('div',{class:'panel'},[ el('h3',{class:'jp',text:t('lookbackTitle')}), el('div',{class:'psub jp',text:t('lookbackSub')}) ]);
  const rows=chapterStats();
  if(rows.length && rows.some(function(r){return r.answered>0;})){
    rows.forEach(function(r){
      const has=r.acc!=null;
      panel.appendChild(el('div',{class:'chrow'},[
        el('div',{class:'chn jp',text:r.label}),
        el('div',{class:'chbar'},[ el('div',{class:'chfill'+(has?'':' todo'),style:'width:'+(has?Math.round(r.acc*100):6)+'%'}) ]),
        el('div',{class:'chv'+(has?'':' todo'),text:has?Math.round(r.acc*100)+'%':t('untouchedShort')})
      ]));
    });
  } else {
    panel.appendChild(el('div',{class:'gnone jp',style:'padding:6px 0',text:t('lookbackEmpty')}));
  }
  // week
  const wa=weekActivity(), mx=Math.max.apply(null,wa.days.map(function(d){return d.n;}).concat([1]));
  const ww=el('div',{class:'weekwrap'});
  ww.appendChild(el('div',{class:'weekhead'},[ el('span',{class:'wh jp',text:t('weekTitle')}), el('span',{class:'wn',text:wa.total+' '+t('q')}) ]));
  const bars=el('div',{class:'weekbars'});
  wa.days.forEach(function(d){ bars.appendChild(el('div',{class:'wbar',style:'height:'+Math.max(8,Math.round(d.n/mx*100))+'%;opacity:'+(d.n===0?0.32:1)}) ); });
  ww.appendChild(bars);
  ww.appendChild(el('div',{class:'weekfoot jp',text:wa.total>0?t('weekFoot'):t('weekFootEmpty')}));
  panel.appendChild(ww);
  return panel;
}

/* ===================== FLASHCARDS（単語帳：术语↔定义翻卡） ===================== */
function flashList(){ return App.idx.concepts.filter(function(c){ const m=App.idx.conceptMeta[c]; return m&&m.exists&&m.definition; }); }
function getCardMark(name){ return (App.progress.cardMarks||{})[name]||null; } // §5-11: 'learned' | 'weak' | null
function toggleCardMark(name,mark){ const cm=App.progress.cardMarks||(App.progress.cardMarks={}); if(cm[name]===mark){ delete cm[name]; } else { cm[name]=mark; } saveProgress(); return cm[name]||null; } // 単選: 同じマーク再押しで解除
function deckList(){ let l=flashList(); if(App.progress.weakOnly){ return l.filter(function(c){ return getCardMark(c)==='weak'; }); } if(App.progress.hideLearned){ l=l.filter(function(c){ return getCardMark(c)!=='learned'; }); } return l; } // weakOnly が優先(苦手だけ) // 覚えたを隠す 時は learned を除外
function renderFlashcards(){
  registerFrame(renderFlashcards,'flashcards');
  if(!App.flash){ const list=C.shuffle(deckList(),App.rng); App.flash={list:list,pos:0,flipped:false}; } // §5-11: 覚えたを隠す 反映済みの牌組
  const F=App.flash;
  F.flipped=false; // F3: 再入場は常に表面から描く(flipped 残留と視覚のねじれ→初回クリック空振り＋aria-hidden 逆貼りを断つ)
  const hideToggle=el('button',{class:'btn ghost sm fc-hide'+(App.progress.hideLearned?' on':''),text:t('cardHideLearned')});
  hideToggle.addEventListener('click',function(){ App.progress.hideLearned=!App.progress.hideLearned; App.progress.weakOnly=false; saveProgress(); App.flash=null; renderFlashcards(); }); // 切替→牌組再構築; 苦手だけと排他
  const weakToggle=el('button',{class:'btn ghost sm fc-hide'+(App.progress.weakOnly?' on':''),text:t('cardWeakOnly')}); // §item7: 苦手だけ専項復習
  weakToggle.addEventListener('click',function(){ App.progress.weakOnly=!App.progress.weakOnly; App.progress.hideLearned=false; saveProgress(); App.flash=null; renderFlashcards(); });
  const kids=[ sectionHead(t('actCards')) ];
  if(!F.list.length){ const emsg=App.progress.weakOnly?t('cardWeakEmpty'):(App.progress.hideLearned?t('cardDeckEmpty'):t('cardsEmpty'));
    const box=el('div',{class:'card'},[ el('p',{class:'muted jp',text:emsg}) ]);
    if(App.progress.weakOnly) box.appendChild(el('div',{style:'margin-top:10px;text-align:center'},[ weakToggle ]));
    else if(App.progress.hideLearned) box.appendChild(el('div',{style:'margin-top:10px;text-align:center'},[ hideToggle ]));
    kids.push(box); return setView(el('div',null,kids)); }
  // v1.3.0 真 3D 翻卡: 两面常驻 DOM, 翻面=切容器旋转类(.flipped, 不重渲); 换卡=瞬时复位旋转(.flip-instant 禁过渡, 绝不出现回翻)+方向性滑入(.flipstage fc-next/fc-prev, 镜像 qStep)。两面绝对叠放故容器须 JS 同步量测两面最大高度(sizeFlip)。reduced-motion 全程瞬时。
  function mReduceF(){ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  const frontPad=el('div',{class:'fc-pad'},[ el('div',{class:'fc-q jp'}), el('div',{class:'fc-hint jp',text:t('tapReveal')}) ]);
  const front=el('div',{class:'flip-face flip-front'},[ frontPad ]);
  const backPad=el('div',{class:'fc-pad'});
  const back=el('div',{class:'flip-face flip-back',id:'fcBack'},[ backPad ]);
  const inner=el('div',{class:'flip-inner'},[ front, back ]);
  // F3: 翻卡=開示操作。裏面に .fc-og-link (対話的子孫)が居るので native button は使えず role=button で代替; 非表示面は aria-hidden+inert で読み上げ木から外す(答えの先バレ防止)
  const flip3d=el('div',{class:'flip3d',role:'button',tabindex:'0','aria-label':t('flipCard'),'aria-expanded':'false','aria-controls':'fcBack'},[ inner ]);
  function syncFaces(){ const fl=!!F.flipped;
    flip3d.setAttribute('aria-expanded',String(fl));
    front.setAttribute('aria-hidden',String(fl)); back.setAttribute('aria-hidden',String(!fl));
    front.inert=fl; back.inert=!fl; }
  syncFaces();
  const stage=el('div',{class:'flipstage'},[ flip3d ]);
  const countEl=el('span',{class:'fc-count'});
  const markBar=el('div',{class:'fc-marks'}); // §5-11: 覚えた(緑)/苦手(桃) 単選トグル(現在カード)
  const bLearned=el('button',{class:'fcm fcm-learned',text:t('cardLearned')}), bWeak=el('button',{class:'fcm fcm-weak',text:t('cardWeak')});
  markBar.appendChild(bLearned); markBar.appendChild(bWeak);
  function paintMarks(){ const m=getCardMark(F.list[F.pos]); bLearned.classList.toggle('on',m==='learned'); bWeak.classList.toggle('on',m==='weak'); }
  bLearned.addEventListener('click',function(){ toggleCardMark(F.list[F.pos],'learned'); paintMarks(); });
  bWeak.addEventListener('click',function(){ toggleCardMark(F.list[F.pos],'weak'); paintMarks(); });
  function sizeFlip(){ const h=Math.max(frontPad.offsetHeight, backPad.offsetHeight, 230); inner.style.minHeight=h+'px'; } // 量测内容包裹层 offsetHeight (与容器高解耦, 不受 flex 居中对称溢出影响); 230 为下限
  function paintFace(){
    const name=F.list[F.pos]; const meta=App.idx.conceptMeta[name];
    front.querySelector('.fc-q').textContent=name;
    backPad.innerHTML='';
    backPad.appendChild(el('div',{class:'fc-term jp',text:name}));
    backPad.appendChild(el('div',{class:'fc-def jp',text:L(meta.definition)}));
    if(meta.origin) backPad.appendChild(el('button',{class:'fc-og-link',text:(App.lang==='ja'?'まとめノートで読む · 第'+meta.origin.kai+'回 ›':'去复习手册读这一节 · 第'+meta.origin.kai+'回 ›'),onclick:function(e){ e.stopPropagation(); var sc=conceptReaderSec(meta.origin.kai,name); readerDir='fwd'; renderReader(meta.origin.kai, sc>=0?sc:0); }})); // item6: 出処=資料集の該当節へ一本化(そこから読み+演習=関連問題に届くので「この概念に触れる問題」は冗長→削除)
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
  flip3d.addEventListener('click',doFlip);
  flip3d.addEventListener('keydown',function(e){ // F3: e.target 判定は必須 — 裏面 .fc-og-link 上の Enter が bubbling で二重発火するのを防ぐ
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
  kids.push(el('div',{class:'flashwrap'},[ stage, markBar, nav, tools ]));
  setView(el('div',null,kids));
  paintFace(); // setView 已挂载 → sizeFlip 可量测; 同步块内, 用户只见末态
}

/* ===================== SEARCH（题干 + 概念 全文检索） ===================== */
/* ===================== 検索(v1.7.0 で全面改修) =====================
 * 旧実装は「入力文字列そのままを q.q と q.topic、概念名と定義に indexOf」だけだった。
 * つまり:正規化なし・仮名の折り畳みなし・複数キーワード AND なし・ヒット強調なし・
 * 本文(手册)は検索対象ですらない・結果から本文の該当節へ跳べない。
 * 読む/さがす主体の神経では検索が主機能なので、简报 §1 の要件どおりに作り直す。 */
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
/* B4: 素の indexOf だと EDA が「(Geday 2003)」に、ERP が hyperpolarization に、ERN が Wernicke に
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
  map[out.length]=raw.length;                    /* 終端 */
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
 * 教員の一言・caveat)まで拾うのが要点。旧実装はここを一切見ていなかった。 */
function buildSearchCorpus(){
  if(App._corpus && App._corpusFor===(App.course&&App.course.id)) return App._corpus;
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
  App._corpus=rows; App._corpusFor=App.course&&App.course.id;
  return rows;
}
function renderSearch(initial){
  registerFrame(function(){ renderSearch(App._searchQ||''); },'search');
  App._searchQ=initial!=null?initial:(App._searchQ||'');
  const ja=App.lang==='ja';
  const kids=[ sectionHead(t('searchTitle')) ];
  const card=el('div',{class:'card'});
  const input=el('input',{class:'searchinput jp',type:'text',placeholder:t('searchPh')});
  input.value=App._searchQ;
  const out=el('div',{class:'searchout'});
  function run(){
    App._searchQ=input.value;
    const terms=sTerms(input.value);
    out.innerHTML='';
    if(!terms.length){
      out.appendChild(el('div',{class:'gnone jp',
        text: sHasTooShort(input.value) ? (ja?'英数字は 2 文字以上で引いてください(例: EDA・P300)':'英文数字请输入 2 个字符以上(例: EDA・P300)')
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
      if(term===q || yomi===q) s+=100;                 // 完全一致
      if(term.indexOf(q)===0 || yomi.indexOf(q)===0) s+=40;  // 前方一致
      if(sHit(r.term,terms)) s+=25;                    // 見出し語に含む
      if(((meta&&meta.aliases)||[]).some(function(a){ return sNorm(a)===q; })) s+=30;  // 別名が完全一致
      if(sHit(r.def||'',terms)) s+=5;                  // 定義に含むだけ
      s-=Math.min(term.length,20)*0.2;                 // 同点なら短い見出し語を上に
      return s;
    };
    cons.sort(function(a,b){ return score(b)-score(a); });
    const bodOnly=bods.filter(function(r){ return !cons.some(function(c){ return c.cardId===r.cardId; }); });
    const total=cons.length+bodOnly.length+cmps.length+qs.length;
    if(!total){ out.appendChild(el('div',{class:'gnone jp',text:t('searchNone')})); return; }
    out.appendChild(el('div',{class:'srsum jp',
      text:(ja?'ヒット ':'命中 ')+total+(ja?' 件':' 条')+(terms.length>1?(ja?'(すべての語を含む)':'(含全部关键词)'):'')}));

    function jumpRow(r){
      const b=el('button',{class:'srow',onclick:function(){
        if(r.kind==='q'){ renderReading(r.q.id,{from:'search'}); return; }
        if(r.kind==='compare'){ gotoCompare(r.gid); return; }
        gotoCard(r.cardId,r.term);
      }});
      return b;
    }
    if(cons.length){
      out.appendChild(el('div',{class:'srhd jp',text:(ja?'概念':'概念')+' ('+cons.length+')'}));
      cons.slice(0,40).forEach(function(r){
        const b=jumpRow(r);
        const main=el('span',{class:'sr-m'});
        main.appendChild(markNode(r.term,terms,'sr-term jp'));
        /* 「しさいぼう」で引くと 視細胞 が当たるが、見出しにも定義にも文字が無いので
         * なぜ当たったのか分からない。当たった読み/別名をその場に出す。 */
        const meta=App.concepts?App.concepts[r.term]:null;
        if(meta && !sHit(r.term,terms) && !sHit(r.def||'',terms)){
          const via=[];
          if(meta.yomi && sHit(meta.yomi,terms)) via.push({l:App.lang==='ja'?'よみ':'读音', v:meta.yomi});
          (meta.aliases||[]).forEach(function(a){ if(sHit(a,terms) && via.length<2) via.push({l:App.lang==='ja'?'別名':'别名', v:a}); });
          if(via.length){
            const vr=el('span',{class:'sr-via'});
            via.forEach(function(x){ vr.appendChild(el('span',{class:'sv-c'},[
              el('em',{text:x.l}), markNode(x.v,terms) ])); });
            main.appendChild(vr);
          }
        }
        main.appendChild(el('small',{class:'jp'},[ markNode(snippet(r.def,terms,52),terms) ]));
        b.appendChild(main);
        b.appendChild(el('span',{class:'sr-k',text:(r.kai?('第'+r.kai+'回'):'')+(r.axis?(' · '+r.axis):'')}));
        out.appendChild(b);
      });
    }
    if(bodOnly.length){
      out.appendChild(el('div',{class:'srhd jp',style:'margin-top:12px',
        text:(ja?'本文・レジュメ注意':'正文・讲义注意')+' ('+bodOnly.length+')'}));
      bodOnly.slice(0,40).forEach(function(r){
        const b=jumpRow(r);
        const main=el('span',{class:'sr-m'});
        main.appendChild(el('span',{class:'sr-term jp',text:r.term}));
        const src=sHit(r.sig||'',terms)?r.sig:(sHit(r.cav||'',terms)?r.cav:r.body);
        main.appendChild(el('small',{class:'jp'},[ markNode(snippet(src,terms,64),terms) ]));
        b.appendChild(main);
        b.appendChild(el('span',{class:'sr-k',text:'第'+r.kai+'回'}));
        out.appendChild(b);
      });
    }
    if(cmps.length){
      out.appendChild(el('div',{class:'srhd jp',style:'margin-top:12px',text:(ja?'対比表':'对比表')+' ('+cmps.length+')'}));
      cmps.slice(0,20).forEach(function(r){
        const b=jumpRow(r);
        const main=el('span',{class:'sr-m'});
        main.appendChild(markNode(r.term,terms,'sr-term jp'));
        main.appendChild(el('small',{class:'jp',text:r.body}));
        b.appendChild(main);
        b.appendChild(el('span',{class:'sr-k',text:(r.kai?('第'+r.kai+'回'):'')}));
        out.appendChild(b);
      });
    }
    if(qs.length){
      out.appendChild(el('div',{class:'srhd jp',style:'margin-top:12px',text:t('q')+' ('+qs.length+')'}));
      qs.slice(0,20).forEach(function(r){
        const b=jumpRow(r);
        const main=el('span',{class:'sr-m'});
        main.appendChild(el('span',{class:'sr-term jp',text:'第'+r.q.kai+'回 · '+(r.q.topic||'')}));
        main.appendChild(el('small',{class:'jp'},[ markNode(snippet(r.q.q,terms,64),terms) ]));
        b.appendChild(main);
        b.appendChild(el('span',{class:'sr-k',text:r.q.kind||''}));
        out.appendChild(b);
      });
    }
  }
  input.addEventListener('input',run);
  card.appendChild(el('div',{class:'searchrow'},[ svgNode(NEW_ICONS.search), input ]));
  card.appendChild(out);
  kids.push(card);
  setView(el('div',null,kids));
  setTimeout(function(){ try{ input.focus(); }catch(e){} run(); },0);
}

/* ===================== BOOKMARKS（书签题：回看 + 重练） ===================== */
function readerBookmarkList(){ // 資料集ブックマーク ["kai:sec"] → [{kai,sec,label,tag}]（renderReader へ跳ぶ）
  const arr=lsGet(nk('readerBm'),[])||[]; const ja=App.lang==='ja';
  return arr.map(function(k){ const p=String(k).split(':'), kai=parseInt(p[0],10), sec=parseInt(p[1],10);
    const unit=(App.manual&&App.manual.units)?App.manual.units.find(function(u){return u.kai===kai;}):null; if(!unit) return null;
    const secs=unit.sections||[];
    const title=(sec===0)?(ja?'はじめに':'开篇'):((secs[sec-1]&&secs[sec-1].title)||'');
    const tag=(sec===0)?'扉':((secs[sec-1]&&secs[sec-1].sectionId)||'');
    return { kai:kai, sec:sec, label:'第'+kai+'回 · '+title, tag:tag };
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
    card.appendChild(rowBtn('第'+q.kai+'回 · '+(q.topic||''), q.kind, function(){ renderReading(id,{from:'book'}); }));
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
function renderBookmarks(){ return renderQuestionMarks(); } // 旧互換（外部呼び出しは問題★へ）

/* ===================== SETTINGS（利き手 / 試験日） ===================== */
/* ===================== ホーム画面に追加 (PWA, v1.6.0): iOS Safari 検出 + 一回限りの軽バナー + 図解チュートリアル ===================== */
function isIOSSafari(){
  try{
    const ua=navigator.userAgent||'';
    const iOS=/iPhone|iPad|iPod/.test(ua) || (navigator.platform==='MacIntel' && (navigator.maxTouchPoints||0)>1); // iPadOS13+ は Mac を詐称
    const webkit=/WebKit/.test(ua);
    const other=/CriOS|FxiOS|EdgiOS|OPiOS|mercury|DuckDuckGo/.test(ua); // iOS 上の Chrome/FF/Edge 等は「追加」UI が無いので除外
    const standalone=(window.navigator.standalone===true) || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return iOS && webkit && !other && !standalone;
  }catch(e){ return false; }
}
function a2hsBannerNode(){ // ホーム上部に一度だけ; ×で恒久的に消す
  if(!isIOSSafari() || lsGet('quiz:a2hs-x')) return null;
  const bar=el('div',{class:'a2hsbar'});
  bar.appendChild(el('span',{class:'a2hsbar-ic',html:NEW_ICONS.share}));
  bar.appendChild(el('span',{class:'a2hsbar-t jp',text:t('a2hsBannerText')}));
  const go=el('button',{class:'a2hsbar-go jp',text:t('a2hsBtn'),onclick:openAddToHome});
  const x=el('button',{class:'a2hsbar-x','aria-label':t('a2hsLater'),text:'\u00D7',onclick:function(){ lsSet('quiz:a2hs-x',1); bar.remove(); }});
  bar.appendChild(el('div',{class:'a2hsbar-act'},[ go, x ]));
  return bar;
}
function openAddToHome(){
  const SHARE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M5 11v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/></svg>';
  const ADD='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 9v6M9 12h6"/></svg>';
  const CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const steps=[ [SHARE,t('a2hsStep1')], [ADD,t('a2hsStep2')], [CHECK,t('a2hsStep3')] ];
  const body=[ el('div',{class:'a2hs-intro jp',text:t('a2hsIntro')}) ];
  const list=el('div',{class:'a2hs-steps'});
  steps.forEach(function(s,i){
    list.appendChild(el('div',{class:'a2hs-step'},[
      el('span',{class:'a2hs-num',text:String(i+1)}),
      el('span',{class:'a2hs-ic',html:s[0]}),
      el('span',{class:'a2hs-tx jp',text:s[1]})
    ]));
  });
  body.push(list);
  body.push(el('div',{class:'a2hs-prev'},[
    el('img',{class:'a2hs-prev-ic',src:'apple-touch-icon.png',alt:'\u10DB\u10D4\u10D8\u10DB\u10D4\u10D8',width:'52',height:'52'}),
    el('span',{class:'a2hs-prev-t jp',text:t('a2hsPreview')})
  ]));
  openModal(modalShell(t('a2hsTitle'),body));
}
function openExamDate(){ // 試験日専用ダイアログ(StatusCard の鉛筆から); 設定パネルからは分離
  const dateInp=el('input',{type:'date',class:'dateinput','aria-label':t('examTitle')}); const cur=getExamDate(); if(cur) dateInp.value=cur; // F9: 無名の日付欄に読み上げ名を与える
  dateInp.addEventListener('change',function(){ setExamDate(dateInp.value||null); });
  openModal(modalShell(t('examTitle'),[
    el('div',{class:'sethelp jp',text:t('examHelp')}),
    el('div',{class:'row',style:'align-items:center'},[ dateInp, el('button',{class:'btn ghost sm',style:'margin-left:8px',text:t('clear'),onclick:function(){ setExamDate(null); dateInp.value=''; }}) ])
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
  const body=[
    el('div',{class:'setblk'},[ el('div',{class:'setlbl jp',text:t('ioTitle')}) ].concat(ioBlock(false))), /* §5-5 ①書き出し/読み込み (reset は末尾へ) */
    el('div',{class:'setblk'},[ el('div',{class:'setlbl jp',text:t('handTitle')}), el('div',{class:'sethelp jp',text:t('handHelp')}), handRow ]), /* ②利き手 */
    el('div',{class:'setblk'},[ el('div',{class:'setlbl jp',text:t('a2hsBtn')}), el('div',{class:'sethelp jp',text:t('a2hsHelp')}),
      el('button',{class:'btn ghost sm',text:t('a2hsBtn'),onclick:openAddToHome}) ]), /* ③ホーム画面に追加 (試験日は StatusCard の鉛筆→openExamDate に分離) */
    el('div',{class:'setblk'},[ el('div',{class:'setlbl jp',text:(App.lang==='zh'?'版本':'バージョン')}),
      el('button',{class:'btn ghost sm',onclick:openUpdates,html:'<span class="mono">v'+APP_VERSION+'</span> · '+t('updTitle')}) ]), /* ④版本 chip 移出顶栏黄金位 → 收进设置（七项④） */
    el('div',{class:'setblk'},[ el('div',{class:'setlbl jp',text:t('resetTitle')}),
      el('div',{class:'row'},[ // F-02: 二段リセット
        el('button',{class:'btn ghost',text:t('resetProg'),onclick:doResetProgress}),
        el('button',{class:'btn ghost',style:'border-color:var(--no-line);color:var(--no-deep)',text:t('reset'),onclick:doReset}) ]) ]) /* ⑤リセット二段 */
  ];
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
function startRunnerTimer(node){ clearRunnerTimer(); if(!node||!App.session) return; // §5-9(a): emoji ⏱ → feather 線描; アイコンは一度だけ組み, 毎秒は時間 span のみ更新
  node.innerHTML='<span class="qt-ic">'+NEW_ICONS.clock+'</span><span class="qt-t"></span>';
  const tEl=node.querySelector('.qt-t');
  function upd(){ if(!node.isConnected||!App.session){ clearRunnerTimer(); return; } tEl.textContent=fmtClock(examElapsed()/1000); }
  upd(); App.runnerTimer=setInterval(upd,1000);
}
let careTick=0;
function fireCarePop(kind){
  try{
    careTick++; var icon=pick(REST_ICONS); var msg; // §5-4: 真随机 pick(旧: careTick 顺送り)
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
const UPDATES=[
  { v:'3.2.0', items:{
      ja:['書き出しが完全バックアップになりました。栞・成績の記録・読書位置なども全部入ります',
          '読み込む前に中身を確認できるようになり、取り込みは自動バックアップ付き・一回だけ元に戻せます',
          'リセットが二段階になりました。「学習進捗だけ消す」と「この課の全データを消す」を選べます',
          'コース切替がキーボードで操作できるようになりました（↑↓で移動・Escで閉じて元の場所へ）',
          '教材データの整合性を毎回確認し、合わない時は止まってお知らせするようにしました',
          '更新の直後に新旧ファイルが混ざって動かなくなる問題への備えを入れました'],
      zh:['导出升级为完整备份：书签、成绩记录、阅读位置等全部包含在内',
          '导入前可以先预览内容；导入带自动备份，可一键撤销一次',
          '重置分成两档：只清学习进度，或清空这门课的全部本地数据',
          '切换课程支持键盘操作了（↑↓移动・Esc 关闭并回到原处）',
          '每次都会核对教材数据的一致性，不吻合时会停下来提示',
          '加入了防止更新后新旧文件混跑的机制']
  }},
  { v:'3.1.0', items:{
      ja:['中身のファイル構成を整理しました（1枚の大きなファイル→7つの部品）。使い勝手・見た目・学習データはそのまま変わりません'],
      zh:['整理了内部文件结构（一个大文件拆成 7 个部件）。用法・外观・学习数据都不变']
  }},
  { v:'3.0.0', items:{
      ja:['神経心理学概論が入りました。右上から科目を切り替えられます',
          '神経は「読む・さがす」ための資料集です。授業まるごとの用語を、測定法→信号→心理機能の流れで並べ直しました',
          '用語は漢字でも、かなでも、略語でも引けます。本文や対比表の中まで探します',
          'レジュメの図はそのまま載せました。波形や分布の図は描き起こしました',
          'レジュメの記述が誤っているところは、正しい説明と並べて注意書きを付けました',
          '配られた問題は、答えと解説を開いた状態で読めます',
          '科目ごとに色が変わります。進みぐあいはそれぞれ別に保たれます'],
      zh:['神经心理学概论上线了。右上角可以切换科目',
          '神经这门是「读与查」的资料集。整门课的术语按 测量法→信号→心理机能 重新排过',
          '术语用汉字、假名、缩写都能查。正文和对比表里也一起找',
          '讲义里的图直接放进来了。波形和分布类的图是重新画的',
          '讲义写错的地方，会把正确说法并排列出来提醒你',
          '课上发的题，答案和解说默认展开，直接读',
          '每门课有自己的配色，进度也各自独立']
  }},
  { v:'2.3.2', items:{
      ja:['トップバーを整理して、ロゴを左へ','მეიმეიの窓が、浮かぶ丸窓になりました','問題の★は「しるしをつけた問題」へ、まとめノートのしおりは「しおり」へ、置き場を分けました','日本語と中国語の文言を、それぞれ書きなおしました','配色を見本に合わせなおしました（正式な色はこれから）'],
      zh:['顶栏理了理，logo 挪到左边','მეიმეი的窗口改成了悬浮圆窗','题目的 ★ 收进「标记的题」，手册夹的页收进「书签」，两边分开','日文和中文的文案，各自重写了一遍','颜色对回了样板（正式配色还在路上）']
  }},
  { v:'2.3.1', items:{
      ja:['ホームと問題画面のレイアウトを一新'],
      zh:['首页和做题页换了新排版']
  }},
  { v:'2.3.0', items:{
      ja:['全体を桜色の新デザインへ（色は仮どめ）','模擬試験の結果が「過去の結果」に残るように','解きながら★をつけられるように','右下にმეიმეიが住みつきました'],
      zh:['整体换上樱色新设计（配色暂定）','模拟考成绩会存进「历史成绩」','做题时可以随手打星标','მეიმეი搬进了右下角']
  }},
  { v:'2.2.0', items:{
      ja:['図解と文字を読みやすく調整','解説の重要用語にマーカー','ボタンに押した手ごたえ'],
      zh:['图解和文字更好读了','解说里的重点术语有了标记','按钮有了按下去的手感']
  }},
  { v:'2.1.1', items:{
      ja:['文言を手直し。「資料集」は「まとめノート」に'],
      zh:['改了些叫法，「资料集」改叫「复习手册」']
  }},
  { v:'2.1.0', items:{
      ja:['第13回を追加。全13回そろいました','解説の出典から、まとめノートへ飛べるように'],
      zh:['加上第13回，全部凑齐了','解说的出处能直接跳进手册']
  }},
  { v:'2.0.0', items:{
      ja:['「まとめノート」登場。読んで復習できるように','ホームが「演習」と「復習」の二本立てに','単語帳に「覚えた」「苦手」マーク'],
      zh:['「复习手册」上线，可以靠读来复习了','首页分成做题和复习两块','单词卡能标「记住了」和「不熟」']
  }},
  { v:'1.6.0', items:{
      ja:['ホーム画面に追加できるように','「間違い」と「苦手」をひとつに'],
      zh:['能添加到主屏幕了','错题和弱点合到了一起']
  }},
  { v:'1.5.0', items:{
      ja:['採点画面を整理'],
      zh:['批改页清爽了']
  }},
  { v:'1.4.0', items:{
      ja:['休憩のお知らせが、集中の流れに合わせて出るように','離席中は時間を数えないように'],
      zh:['休息提醒会看你的节奏了','人不在时不计时']
  }},
  { v:'1.3.0', items:{
      ja:['画面切り替えに動きをつけました','回ごとの進みぐあいから復習をはじめられるように'],
      zh:['翻页有了动效','能从各回进度直接开始复习']
  }},
  { v:'1.2.0', items:{
      ja:['表示の安定化と不具合修正'],
      zh:['显示更稳，修了些小毛病']
  }},
  { v:'1.1.0', items:{
      ja:['さくら色に。試験日カウントダウンと単語帳を追加'],
      zh:['换上樱色，加了考试日倒计时和单词卡']
  }}
];
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
