/* dev.js ― 开发者面板（数据健康诊断・乱序自检・诊断信息复制）。只在 ?dev=1 时由 index.html 同步载入；
 * 正常使用时这个部件不下载、不执行。面板里的文字只给开发者看，不进 i18n。 */
'use strict';

let lastError=null;
function installErrorBoundary(){
  window.addEventListener('error',function(e){ lastError={msg:e.message,stack:e.error&&e.error.stack,at:Date.now()}; });
  window.addEventListener('unhandledrejection',function(e){ lastError={msg:'unhandledrejection: '+(e.reason&&e.reason.message||e.reason),stack:e.reason&&e.reason.stack,at:Date.now()}; });
}
function openDev(){
  const v=App.validation||{errors:[],warnings:[],degraded:[],stats:{byKai:{},byType:{}},degeneracy:{}};
  const inner=el('div',{class:'dev-in'});
  inner.appendChild(el('button',{class:'modal-x',text:'×','aria-label':t('close'),onclick:closeDev}));
  inner.appendChild(el('h3',{text:'DEV · データ健康診断'}));
  inner.appendChild(el('div',{class:'muted',text:'course: '+(App.course?App.course.id:'-')+' · engine '+C.VERSION+' · app '+APP_VERSION}));
  const counts=el('div',{class:'dev-sec'},[ el('h4',{text:'Loaded'}) ]);
  counts.appendChild(el('div',{text:'total: '+v.stats.total+'  ·  choice: '+(v.stats.byType.choice||0)+'  ·  subjective: '+(v.stats.byType.subjective||0)+'  ·  concepts: '+v.stats.conceptCount}));
  const kaiPills=el('div',{style:'margin-top:6px'}); App.idx.kais.forEach(k=>kaiPills.appendChild(el('span',{class:'pill2',text:'回'+k+':'+(v.stats.byKai[k]||0)})));
  counts.appendChild(kaiPills);
  if(v.stats.dupIds.length) counts.appendChild(el('div',{class:'devwarn',text:'dup ids: '+v.stats.dupIds.join(', ')}));
  inner.appendChild(counts);
  const val=el('div',{class:'dev-sec'},[ el('h4',{text:'Validation'}) ]);
  val.appendChild(el('div',{class:v.errors.length?'devbad':'devok',text:'errors: '+v.errors.length}));
  v.errors.slice(0,40).forEach(e=>val.appendChild(el('div',{class:'devbad',text:'· ['+e.id+'] '+e.msg})));
  val.appendChild(el('div',{class:v.warnings.length?'devwarn':'devok',text:'warnings: '+v.warnings.length}));
  v.warnings.slice(0,30).forEach(e=>val.appendChild(el('div',{class:'devwarn',text:'· ['+e.id+'] '+e.msg})));
  val.appendChild(el('div',{style:'margin-top:6px',text:'graceful-degrade: '+v.degraded.length+' 件'}));
  v.degraded.slice(0,20).forEach(e=>val.appendChild(el('div',{class:'muted',style:'font-size:11px',text:'· ['+e.id+'] '+e.reason})));
  inner.appendChild(val);
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
  const shf=el('div',{class:'dev-sec'},[ el('h4',{text:'乱序自检 (reshuffle)'}) ]);
  const sample=App.questions.find(q=>q.kai===10&&q.type==='choice')||App.questions.find(q=>q.type==='choice');
  const out=el('div',{class:'mono',style:'font-size:11px'});
  function drawShuffle(){ const ord=C.shuffleOptions(sample.options,App.rng); out.textContent=sample.id+' → '+ord.map((o,i)=>i+':'+(o.correct?'✔':'·')).join('  '); }
  drawShuffle();
  shf.appendChild(el('div',{class:'muted',style:'font-size:11px',text:'c10 是退化存储(correct 恒在 0)。每次乱序应把 ✔ 打散到不同位置：'}));
  shf.appendChild(out);
  shf.appendChild(el('button',{class:'btn sm',style:'margin-top:8px',text:'再シャッフル',onclick:drawShuffle}));
  inner.appendChild(shf);
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

/* DEV 按钮：只在本部件载入时才出现在页面上 */
(function(){
  const b=document.createElement('button');
  b.className='devbtn'; b.id='devBtn'; b.textContent='DEV';
  b.addEventListener('click',function(){ openDev(); });
  document.body.insertBefore(b,document.getElementById('modalRoot'));
})();
