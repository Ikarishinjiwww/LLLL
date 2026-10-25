/* rx-search.js ― 新課（rx-content/1）の検索と、書き出しに添える AI 提示の材料（Q-026）。
 * 検索の対象：回（題・シラバス）・カード（題・欄の見出しと本文・病名・症状・表・図の説明・発展の段落）・
 *   本文（命題の文・思い出す問い・講義／標準／試験の三欄・知識点の見出し）・概念名・
 *   讲解块（ix.explain の本文。「カード」の組に出し、着地は「読む」）・用語表（回の glossary の用語・読み・意味・注意。RX_FLAGS.glossary が false なら入れない）。4.3.3 #1（FX1-07・HF1-02）
 * 対象にしない：誤述（わざと誤った文。当たると誤解を招く）・演習の問題・過去問（解錠後もメモリだけ）・文献。
 * 照合は旧課の検索と同じ部品（panels.js の sNorm・sTerms・sFind・markNode・snippet）。
 * 着地は rxGoCard 経由で、命題が「いま画面のどこに出ているか」を DOM で探す：回のページの見せ方（命題を何度出すか・
 *   三欄を畳むか）に依存しない。 */

const RXS_CAP=40;

function rxSearchBarNode(){ // 新課ホームの検索の入口（本物の button：Tab/Enter/読み上げ名）
  return el('button',{type:'button',class:'searchbar rx-srchbar',onclick:function(){ rxSearchOpen(''); }},[
    el('span',{class:'svgwrap','aria-hidden':'true',html:NEW_ICONS.search}),
    el('span',{class:'sbph jp',text:t('rxSearchPh')})
  ]);
}

/* 検索の行を課の実データから組む。課と言語で覚えておく（概念名は将来ほかの言語が付いても L() で取る） */
function rxsCorpus(){
  const key=App.course.id+'|'+App.lang;
  if(App._rxsCorpus && App._rxsCorpusFor===key) return App._rxsCorpus;
  const ix=App.rx.ix, ct=App.rx.content, rows=[];
  const row=function(o,parts){ o.parts=parts.filter(Boolean).map(String); o.n=sNorm(o.parts.join('\n')); rows.push(o); };
  ix.lectures.forEach(function(Lc){
    row({g:'lec',lec:Lc.id,kai:Lc.kai,title:tf('kaiN',{n:Lc.kai})+'　'+(Lc.title||''),name:Lc.title||''},[Lc.title,Lc.syllabus]);
    RX.orderOf(Lc).forEach(function(cid){
      const c=ix.cards[cid]&&ix.cards[cid].card; if(!c) return;
      const parts=[c.title];
      (c.fields||[]).forEach(function(f){ if(f){ parts.push(f.label); parts.push(f.text); } });
      parts.push(c.names);
      (c.symptoms||[]).forEach(function(s){ parts.push(s); });
      (c.cols||[]).forEach(function(s){ parts.push(s); });
      (c.rows||[]).forEach(function(r){ ((r&&r.cells)||[]).forEach(function(s){ parts.push(s); }); });
      parts.push(c.alt);
      (c.blocks||[]).forEach(function(b){ if(b) parts.push(b.text); });
      row({g:'card',lec:Lc.id,kai:Lc.kai,card:cid,title:c.title||'',name:c.title||''},parts);
    });
    (Lc.props||[]).forEach(function(p){
      const k=p.kp&&ix.kps[p.kp], tr=p.triple||{};
      const fc=RX.firstCardOf(ix,p.id), fcard=fc&&ix.cards[fc]&&ix.cards[fc].card;
      const o={g:'prop',lec:Lc.id,kai:Lc.kai,prop:p.id,title:(fcard&&fcard.title)||(Lc.title||''),text:p.text||'',recall:p.recall||'',
        tri:[tr.lecture,tr.standard,tr.exam].filter(Boolean).join('\n')};
      row(o,[p.text,p.recall,tr.lecture,tr.standard,tr.exam,k&&k.label]);
    });
  });
  ix.lectures.forEach(function(Lc){ // 讲解块（「読む」にだけ出る本文）：一块一行。見出しはカードの題、当たりの抜粋は块の本文から
    RX.orderOf(Lc).forEach(function(cid){ const c=ix.cards[cid]&&ix.cards[cid].card;
      ((ix.explain&&ix.explain[cid])||[]).forEach(function(b){ row({g:'explain',lec:Lc.id,kai:Lc.kai,card:cid,block:b.id,title:(c&&c.title)||'',name:(c&&c.title)||'',text:b.text},[b.text]); }); });
    if(RX_FLAGS.glossary!==false && typeof rxGlossRows==='function') rxGlossRows(Lc).forEach(function(g){ // 用語表（表と同じ開關・同じ行の取り方）
      row({g:'gloss',lec:Lc.id,kai:Lc.kai,term:g.term,title:g.term,name:g.term},[g.term,g.yomi,g.gloss,g.note]); });
  });
  Object.keys(ct.concepts||{}).forEach(function(g){
    const nm=L(ct.concepts[g])||''; if(nm) row({g:'concept',concept:g,title:nm,name:nm},[nm]);
  });
  App._rxsCorpus=rows; App._rxsCorpusFor=key;
  return rows;
}
function rxsHit(r,terms){ return terms.every(function(x){ return sFind(r.n,x); }); }
function rxsScore(r,terms){ // 見出しが検索語そのもの → 見出しの頭 → 見出しに含む → 本文だけ
  if(r.g==='prop') return 0;
  const nm=sNorm(r.name||''), q=terms.join('');
  let s=0;
  if(nm===q) s+=100;
  if(nm.indexOf(q)===0) s+=40;
  if(terms.every(function(x){ return sFind(nm,x); })) s+=25;
  return s-Math.min(nm.length,20)*0.2;
}
function rxsSource(r,terms){ // 結果の下の一行：当たった部分（命題なら文 → 問い → 三欄の順）
  if(r.g==='prop'){ const c=[r.text,r.recall,r.tri].find(function(x){ return x && sHit(x,terms); }); return c||r.text; }
  if(r.g==='explain') return r.text;
  const p=r.parts.slice(1).find(function(x){ return sHit(x,terms); });
  return p||r.parts.slice(1).join('　');
}

function rxSearchOpen(q){
  registerFrame(function(){ rxSearchOpen(App.rxSearchQ||''); },'rx-search');
  App.rxSearchQ=q!=null?q:(App.rxSearchQ||'');
  const back=(navDir==='back'); // 戻ってきたときは入力欄に焦点を入れない（キーボードが結果を隠さない）
  const input=el('input',{class:'searchinput jp',type:'search',enterkeyhint:'search',placeholder:t('rxSearchPh'),'aria-label':t('rxSearchPh')});
  input.value=App.rxSearchQ;
  const out=el('div',{class:'searchout'});
  const run=function(){
    App.rxSearchQ=input.value;
    const terms=sTerms(input.value);
    out.innerHTML='';
    if(!terms.length){ out.appendChild(el('div',{class:'gnone jp',text:sHasTooShort(input.value)?t('srTooShort'):t('rxSearchHint')})); return; }
    const all=rxsCorpus().filter(function(r){ return rxsHit(r,terms); }), seen={};
    all.forEach(function(r){ if(r.g==='card') seen[r.card]=1; });
    const hits=all.filter(function(r){ if(r.g!=='explain') return true; if(seen[r.card]) return false; seen[r.card]=1; return true; }); // 讲解块はカードごとに一行（カード自体が当たっていればカードの行だけ）
    if(!hits.length){ out.appendChild(el('div',{class:'gnone jp',text:t('searchNone')})); return; }
    out.appendChild(el('div',{class:'srsum jp',text:tf('srHits',{n:hits.length})+(terms.length>1?t('srAllTerms'):'')}));
    const glossLb=(t('coLabel')||{})['用語']||'用語'; // 用語表の組の見出し＝既存の札「用語」（快审第五批で签发済み）
    [['concept',t('srConcepts')],['gloss',glossLb],['lec',t('rxSrLec')],['card',t('rxSrCard'),'explain'],['prop',t('rxSrProp')]].forEach(function(gk){
      const list=hits.filter(function(r){ return r.g===gk[0] || (gk[2] && r.g===gk[2]); });
      if(!list.length) return;
      const sc=list.map(function(r,i){ return {r:r,i:i,s:rxsScore(r,terms)}; });
      sc.sort(function(a,b){ return b.s-a.s || a.i-b.i; });
      out.appendChild(el('div',{class:'srhd jp',style:out.querySelector('.srhd')?'margin-top:12px':null,text:gk[1]+' ('+list.length+')'}));
      sc.slice(0,RXS_CAP).forEach(function(x){ out.appendChild(rxsRow(x.r,terms)); });
    });
  };
  let composing=false, tmr=null, stmr=null; // 日本語入力の変換中は検索しない・打鍵ごとではなく少し待ってから（旧課と同じ）
  const sync=function(){ // 再読み込みで検索語ごと戻せるよう、画面の hash を追従。Safari は replaceState の回数に上限があるので、検索より長く待つ
    clearTimeout(stmr); stmr=setTimeout(function(){ if(typeof navSync==='function') navSync(); },500); };
  input.addEventListener('compositionstart',function(){ composing=true; });
  input.addEventListener('compositionend',function(){ composing=false; run(); sync(); });
  input.addEventListener('input',function(e){ if(composing||e.isComposing) return; clearTimeout(tmr); tmr=setTimeout(run,150); sync(); });
  const card=el('div',{class:'card'},[ el('div',{class:'searchrow'},[ svgNode(NEW_ICONS.search), input ]), out ]);
  setView(el('div',{class:'rx-search'},[ sectionHead(t('searchTitle')), card ]));
  run();
  // 焦点は空の検索を開いたときだけ（入口から来たとき）。語のある画面へ戻る・再読み込みで戻るときは入れない：
  // WebKit では焦点が後から先頭へ引き戻し、覚えていた位置を消していた。携帯ではキーボードが結果を隠す
  if(!back && !App.rxSearchQ){ try{ input.focus({preventScroll:true}); }catch(e){} }
}
function rxsRow(r,terms){ // 行の印は data-pid（data-prop は回のページの命題行の印なので使わない）
  const b=el('button',{class:'srow','data-g':r.g,'data-lec':r.lec||null,'data-card':r.card||null,'data-pid':r.prop||null,'data-concept':r.concept||null,'data-block':r.block||null,'data-term':r.g==='gloss'?r.term:null,
    onclick:function(){
      if(r.g==='concept'){ renderRxConcept(r.concept); return; }
      if(r.g==='lec'){ renderRxLecture(r.lec); return; }
      if(r.g==='explain'){ rxsLandExplain({lec:r.lec,card:r.card,block:r.block,terms:terms}); return; }
      if(r.g==='gloss'){ rxsLandGloss({lec:r.lec,term:r.term,terms:terms}); return; }
      rxSearchLand({lec:r.lec,card:r.card,prop:r.prop,terms:terms,
        inTriple:r.g==='prop' && !sHit(r.text,terms) && !sHit(r.recall,terms) && sHit(r.tri,terms)});
    }});
  const main=el('span',{class:'sr-m'});
  main.appendChild(markNode(r.title,terms,'sr-term jp'));
  if(r.g!=='concept'){
    const src=r.g==='lec'?(r.parts[1]||''):rxsSource(r,terms);
    if(src) main.appendChild(el('small',{class:'jp'},[ markNode(snippet(src,terms,56),terms) ]));
  }
  b.appendChild(main);
  if(r.kai!=null && r.g!=='lec') b.appendChild(el('span',{class:'sr-k',text:tf('kaiN',{n:r.kai})}));
  return b;
}

/* 着地：a={lec, prop?, card?, inTriple?, terms?}。回のページをまだ出していなければ出し（戻るで検索へ）、
 * 命題が実際に出ている場所を DOM で探す（三欄に当たったなら三欄のある箇所を優先）。
 * 畳まれた details は開き、rxGoCard で着地・強調する（「隠して思い出す」は rxGoCard が着地のカードだけ解く：CR-04）。
 * 検索語の色は、rxGoCard が実際に着いたカード（App.rxLand.card）に付ける。 */
function rxSearchLand(a){
  const ix=App.rx.ix, Lc=ix.lecById[a.lec]; if(!Lc) return;
  const top=viewStack[viewStack.length-1];
  if(!top || top.key!=='rx-lec:'+a.lec) renderRxLecture(a.lec, a.card||(a.prop?RX.firstCardOf(ix,a.prop):null)); // 窄幅の翻頁：目標のカード（命題なら本拠）の頁を出す（PS18：1 頁目に落ちて行が無かった）
  const view=document.getElementById('view');
  let node=null, cardId=null;
  if(a.prop){
    const esc=(window.CSS&&CSS.escape)?CSS.escape:function(x){ return String(x).replace(/["\\]/g,'\\$&'); }; const sel='[data-prop="'+esc(a.prop)+'"]'; // 属性値は逸脱させる（#17⑥） // カードの中と要点だけを見る（切替の動きのあいだ、前の画面が #view に残っていることがある）
    const all=[].slice.call(view.querySelectorAll('[id^="rxc-"] '+sel+', #rx-sum '+sel));
    const inCard=all.filter(function(n){ return n.closest('[id^="rxc-"]'); });
    const withTri=inCard.filter(function(n){ const w=n.closest('.rx-prop-w'); return w && w.querySelector('.rx-tri,.rx-tri-tog'); }); // ux/render：三栏は「比較」（.rx-tri-tog）で開くまで DOM に無い
    node=(a.inTriple && withTri[0]) || inCard[0] || null;
    const H=App.rxHome; // 本拠が「講義と標準のずれ」の命題（カードに行が無い）：rxGoGaps でその行へ（「読む」なら臨時に「覚える」。S6 ux/render・総指揮裁定 2026-10-14）
    if(!node && H && H.lec===a.lec && H.map && H.map[a.prop]==='gaps' && typeof rxGoGaps==='function'){ rxGoGaps(a.prop,{anchor:'prop',hold:true,reveal:true}); rxsMarkLanded(a.terms,null); return; }
    if(!node && all[0]){ rxsLandSummary(all[0],a.terms); return; } // 要点にしか出ない命題（CR-09）
  }
  if(node) cardId=node.closest('[id^="rxc-"]').id.slice(4);
  else if(a.card && document.getElementById('rxc-'+a.card)) cardId=a.card;
  else if(a.prop) cardId=RX.firstCardOf(ix,a.prop);
  if(!cardId) return;
  if(!document.getElementById('rxc-'+cardId)){ renderRxLecture(a.lec,cardId); if(!document.getElementById('rxc-'+cardId)) return; // 回のページは出ているがカードは別の頁（翻頁）：その頁を出してから。無ければそこで止める
    if(a.prop){ const n2=[].slice.call(view.querySelectorAll('[id^="rxc-"] [data-prop="'+((window.CSS&&CSS.escape)?CSS.escape(a.prop):a.prop)+'"]')); const wt=n2.filter(function(n){ const w=n.closest('.rx-prop-w'); return w && w.querySelector('.rx-tri,.rx-tri-tog'); }); node=(a.inTriple && wt[0]) || n2[0] || node; } } // 描き直したら命題の節点を探し直す（高亮・三栏の展開のため）
  const cel=document.getElementById('rxc-'+cardId);
  for(let d=(node||cel).closest('details'); d; d=d.parentElement&&d.parentElement.closest('details')) d.open=true;
  if(node && a.inTriple){ const w=node.closest('.rx-prop-w'); if(w){ w.querySelectorAll('details').forEach(function(d){ d.open=true; });
    const tog=w.querySelector('.rx-tri-tog'); if(tog && tog.getAttribute('aria-expanded')!=='true' && tog.__set) tog.__set(true); } } // 三栏に当たった：比較を開いて当たった語が見えるように（ux/render）
  // 命中の行を顶栏の下 1/3 に置き、強調は利用者が動くまで（最長約 3 秒）残す（C-N01）。「隠して思い出す」を解くのは検索の着地だけ：reveal で明示する（N-B）
  rxGoCard(cardId,a.prop||null,a.prop?{anchor:'prop',hold:true,reveal:true}:{reveal:true});
  rxsMarkLanded(a.terms,cardId);
}
/* 讲解块・用語表への着地（4.3.3 #1・HF1-02）：どちらも「読む」にだけ出る。表示が「覚える」なら臨時に「読む」（App.rxViewTmp：偏好 rx:view には書かない。
 * ずれ→臨時に「覚える」（rxGoGaps）と対の扱い）。着地の高亮・保持・錨止めは命題への着地と同じ部品（rxGoCard の opts.row／rxAlignLanding） */
function rxsAttrSel(name,v){ return '['+name+'="'+String(v).replace(/["\\]/g,'\\$&')+'"]'; } // 値に引用符・逆斜線があっても壊れない属性選択子
function rxsReadView(Lc){ if(rxViewOf(Lc)!=='read') App.rxViewTmp={lec:Lc.id,view:'read'}; }
function rxsLandExplain(a){
  const ix=App.rx.ix, Lc=ix.lecById[a.lec]; if(!Lc || !ix.cards[a.card]) return;
  rxsReadView(Lc);
  const top=viewStack[viewStack.length-1], here=document.getElementById('rxc-'+a.card);
  if(!top || top.key!=='rx-lec:'+a.lec || !here || !here.classList.contains('rx-read')) renderRxLecture(a.lec,a.card); // 「覚える」で出ていた・別の頁：「読む」で描き直す（焦点のカードの頁へ）
  const sel=rxsAttrSel('data-explain',a.block);
  rxGoCard(a.card,null,{reveal:true,row:sel,hold:true});
  if(App.rxLand && App.rxLand.card===a.card) App.rxLand.terms=a.terms||null; // 描き直し（rxMarkLanding）でも検索語の色を付け直す
  const n=document.querySelector('#view #rxc-'+a.card+' '+sel);
  if(n && a.terms && a.terms.length) rxsMarkIn(n,a.terms);
}
function rxsLandGloss(a){
  const ix=App.rx.ix, Lc=ix.lecById[a.lec]; if(!Lc) return;
  rxsReadView(Lc);
  renderRxLecture(Lc.id,null,{page:0}); // 用語表は 1 頁目（窄幅の翻頁）
  const box=document.querySelector('#view #rx-gloss'); if(!box) return;
  box.open=true; App.rxGlossOpen=Lc.id; // 描き直しても開いたまま（rxGlossBlock）
  const sel=rxsAttrSel('data-gloss-term',a.term), r=box.querySelector(sel); if(!r) return;
  window.scrollBy(0,r.getBoundingClientRect().top-rxRowTarget());
  if(a.terms && a.terms.length) rxsMarkIn(r,a.terms);
  App.rxLand={card:null,gloss:a.term,lec:Lc.id,row:sel,terms:a.terms||null,until:Date.now()+3000,hold:true}; // 強調・保持・描き直しでの付け直しは命題の着地と同じ rxMarkLanding（利用者が動かした時点で until を今に：CR433-5）
  rxMarkLanding();
  if(typeof rxAlignLanding==='function') rxAlignLanding(null,sel,'rx-gloss',Lc.id); // 図の読み込みなどで版面が動いても、その行に合わせ直す（利用者が動かすまで）
  if(r && typeof rxFocusLanding==='function') rxFocusLanding(r); // #31：用語の着地にも焦点（h1 に残り、画面外に置き去りだった：S4 2026-10-25。範囲は #31 に含むと確定：CR433-38d）
}
function rxsHold(n){ // 行の強調を、利用者が動かすまで（最長約 3 秒）残す（命題・要点への着地と同じ振る舞い）
  n.classList.add('rx-hl');
  const evs=['wheel','touchstart','keydown','pointerdown'];
  let tm=0; const stop=function(){ clearTimeout(tm); evs.forEach(function(ev){ window.removeEventListener(ev,stop,{capture:true}); }); n.classList.remove('rx-hl'); };
  tm=setTimeout(stop,3000);
  evs.forEach(function(ev){ window.addEventListener(ev,stop,{passive:true,capture:true}); });
}
/* 検索語の色は rxGoCard／rxGoGaps が実際に着いた所に付ける：App.rxLand.gaps なら #rx-gaps の命題の行、そうでなければ App.rxLand.card（無ければ呼んだカード）。 */
function rxsMarkLanded(terms,cardId){
  if(!terms || !terms.length) return;
  const L=App.rxLand;
  if(L && L.gaps){ rxsMarkIn([].slice.call(document.querySelectorAll('#view #rx-gaps [data-prop="'+L.prop+'"]')).filter(function(n){ return !n.closest('.nav-leave-fwd,.nav-leave-back'); })[0]||null,terms); return; } // 離場層の古い頁は数えない
  const landed=(L&&L.card)||cardId; if(landed) rxsMarkIn(document.getElementById('rxc-'+landed),terms);
}
/* 「この回の要点」にしか出ない命題への着地（CR-09）：畳まれた残り（.rx-sum-x）と隠れた答え（.hide）を、
 * ページ自身のボタンで開いてから（開閉の表示・aria と食い違わない）、行を顶栏の下約 1/3 に置き、
 * 強調は利用者が動かすまで（最長約 3 秒）残す：カードへの着地（rxGoCard の anchor・hold）と同じ振る舞い。 */
function rxsLandSummary(n,terms){
  const row=n.closest('.rx-sum-i'), box=n.closest('.rx-sum');
  if(row && row.classList.contains('rx-sum-x')){ const more=box&&box.querySelector('.rx-sum-more'); if(more) more.click(); else row.classList.remove('rx-sum-x'); }
  const ans=n.closest('.rx-sum-a'), q=row&&row.querySelector('.rx-sum-q');
  if(ans && ans.classList.contains('hide')){ if(q) q.click(); else ans.classList.remove('hide'); }
  if(q){ try{ q.focus({preventScroll:true}); }catch(e){} } // 「残りを表示」は焦点を別の行へ送る：着いた行の問いへ戻す
  window.scrollBy(0,n.getBoundingClientRect().top-rxRowTarget());
  if(terms && terms.length) rxsMarkIn(n,terms);
  rxsHold(n);
}
function rxsMarkIn(root,terms){ // 着いたカードの中の検索語に色を付ける（次に描き直すまで）
  if(!root) return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(n){
    return (n.nodeValue.trim() && !(n.parentNode&&n.parentNode.closest&&n.parentNode.closest('mark,button,svg,style,script'))) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }});
  const list=[]; while(w.nextNode()) list.push(w.currentNode);
  list.forEach(function(n){
    const nn=sNorm(n.nodeValue); if(!terms.some(function(x){ return nn.indexOf(x)>=0; })) return; // 当たらない文字列は組み直さない
    const m=markNode(n.nodeValue,terms);
    if(!m.querySelector('mark')) return;
    const frag=document.createDocumentFragment(); while(m.firstChild) frag.appendChild(m.firstChild);
    n.parentNode.replaceChild(frag,n);
  });
}

/* 書き出しに添える AI 提示（新課）：まだ覚えていない命題のうち、間違えた・自信のなかったものから、回・カード・概念と、
 * よく引っかかる誤りの型を材料にする。旧課の progress.wrong は新課では空のままなので、そちらは使わない。 */
function rxExportAIPrompt(){
  const ix=App.rx.ix, ct=App.rx.content;
  const sc=lsGet(nk('rx:sched'),null), ps=(sc&&sc.props)||{};
  const miss=function(s){ return ((s&&s.wrong)|0)+((s&&s.unsure)|0); };
  const weak=Object.keys(ps).filter(function(pid){ const s=ps[pid]; return ix.props[pid] && s && !s.mastered && miss(s)>0; })
    .sort(function(a,b){ return miss(ps[b])-miss(ps[a]) || (a<b?-1:1); });
  const kaiSet={}, cards=[], cons=[];
  weak.forEach(function(pid){
    const e=ix.props[pid], Lc=ix.lecById[e.lec]; if(Lc) kaiSet[Lc.kai]=1;
    const cid=RX.firstCardOf(ix,pid), c=cid&&ix.cards[cid]&&ix.cards[cid].card;
    if(c && c.title && cards.indexOf(c.title)<0) cards.push(c.title);
    (e.prop.concepts||[]).forEach(function(g){ const nm=ct.concepts&&ct.concepts[g]&&L(ct.concepts[g]); if(nm && cons.indexOf(nm)<0) cons.push(nm); });
  });
  const kais=Object.keys(kaiSet).map(Number).sort(function(a,b){ return a-b; });
  const tamper=RX.topTamper(lsGet(nk('rx:stats'),null),5).map(function(x){ return ix.tamper[x.code]||x.code; });
  const sep='、', subj=(App.course&&App.course.subject)?L(App.course.subject):L(App.course.title);
  const lines=[ t('aiExpRole').replace('{subject}',subj), '', t('aiExpTaskRx') ];
  if(weak.length){
    lines.push('', t('aiExpMaterialsRx'));
    lines.push('・'+t('aiExpKaiLabel')+'：'+kais.join(sep));
    if(cards.length) lines.push('・'+t('rxSrCard')+'：'+cards.slice(0,20).join(sep));
    if(cons.length) lines.push('・'+t('aiExpConceptLabel')+'：'+cons.slice(0,40).join(sep));
    if(tamper.length) lines.push('・'+t('rxTopTamper')+'：'+tamper.join(sep));
    lines.push('', t('aiExpUse'));
  } else lines.push('', t('aiExpCleanRx')); // 取材条件で見つからなかった（＝間違いが無い、とは言わない：快审第二十三批）
  return { prompt:lines.join('\n'), materials:{ kais:kais, cards:cards.slice(0,20), concepts:cons.slice(0,40), tamper:tamper } };
}
