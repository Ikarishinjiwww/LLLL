/* rx-core.js ― 新课契约（rx-content/1）的纯逻辑：校验与降级・索引。无 DOM，可单测。
 * 数据形状见课程目录的数据规格（S3）；旧两课不经过本文件。 */
'use strict';
var RX = (function () {
  var CONTRACT = 'rx-content/1';

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }

  /* 校验：致命错误＝无法呈现这门课（契约不符・课程不符・无回）；其余缺字段只降级并记诊断。 */
  function validate(course, content, expectId) {
    var fatal = [], diag = [];
    if (!isObj(course) || course.schema !== CONTRACT) fatal.push('course.json: schema ≠ ' + CONTRACT);
    if (!isObj(content) || content.schema !== CONTRACT) fatal.push('content.json: schema ≠ ' + CONTRACT);
    if (isObj(content) && expectId && content.course !== expectId) fatal.push('content.json: course「' + content.course + '」≠ ' + expectId);
    if (isObj(content) && !arr(content.lectures).length) fatal.push('content.json: lectures が空');
    if (!fatal.length) {
      arr(content.lectures).forEach(function (L) {
        if (!L || !L.id) { diag.push('lecture without id'); return; }
        if (!arr(L.props).length) diag.push(L.id + ': props なし');
        if (!arr(L.order).length) diag.push(L.id + ': order なし（cards の並びで代用）');
        if (!isObj(L.summary)) diag.push(L.id + ': summary なし');
      });
      // 任意：概念显示名 {g:slug:{ja}}・旧课映射 {g:slug:{旧课ID:概念名}}（跨课链接用；形不对只记诊断、用时跳过）
      if (content.concepts != null && !isObj(content.concepts)) diag.push('concepts: object でない');
      if (content.legacy != null && !isObj(content.legacy)) diag.push('legacy: object でない');
    }
    return { fatal: fatal, diag: diag };
  }

  /* 索引：命题・变体・卡片・题目・知识点按 id；命题→所在卡片（按 order 的出现顺序）。
   * 引用不到的 id 只记诊断，不抛错（降级）。 */
  function buildIndex(content) {
    var ix = { lectures: [], lecById: {}, props: {}, variants: {}, cards: {}, questions: {}, kps: {},
               propCards: {}, tamper: {}, refs: {}, explain: {}, diag: [] }; // explain＝カード id → 通った讲解块（「読む」・検索が読む。4.3.0 補丁 F-01：索引を作っていなかった）
    arr(content.tamper_types).forEach(function (t) { if (t && t.code) ix.tamper[t.code] = t.name || t.code; });
    arr(content.refs).forEach(function (r) { if (r && r.id) ix.refs[r.id] = r; });
    arr(content.lectures).forEach(function (L) {
      if (!L || !L.id) return;
      ix.lectures.push(L); ix.lecById[L.id] = L;
      arr(L.kps).forEach(function (k) { if (k && k.id) ix.kps[k.id] = k; });
      arr(L.props).forEach(function (p) {
        if (!p || !p.id) return;
        ix.props[p.id] = { prop: p, lec: L.id };
        arr(p.variants).forEach(function (v) { if (v && v.id) ix.variants[v.id] = { variant: v, prop: p.id }; });
      });
      arr(L.cards).forEach(function (c) { if (c && c.id) { ix.cards[c.id] = { card: c, lec: L.id }; indexExplain(ix, c); } });
      arr(L.questions).forEach(function (q) { if (q && q.id) ix.questions[q.id] = { q: q, lec: L.id }; });
    });
    ix.lectures.sort(function (a, b) { return (a.kai || 0) - (b.kai || 0); });
    ix.lectures.forEach(function (L) {
      orderOf(L).forEach(function (cid) {
        var c = ix.cards[cid] ? ix.cards[cid].card : null;
        if (!c) { ix.diag.push(L.id + ': order の ' + cid + ' がない'); return; }
        cardProps(c).forEach(function (pid) {
          if (!ix.props[pid]) { ix.diag.push(cid + ': 命題 ' + pid + ' がない'); return; }
          var list = ix.propCards[pid] || (ix.propCards[pid] = []);
          if (list.indexOf(cid) < 0) list.push(cid);
        });
      });
    });
    return ix;
  }

  /* 讲解块（カード級 explain：呈现修复方案 §4-1 の宽松校验）。
   * 跳过＝diag に記して表示しない：disease/body/topic 以外のカードの块、explain が配列でないカード全体、text が空の块、
   * props が配列でない块、このカードに無い・存在しない命題を挂けた块。role が四値にない・hashes は、diag だけ記して照常表示（hashes は見ない）。
   * 残缺データは致命にしない（HF1-01・03）：kind・role・id・props の要素は own property／文字列として扱い、オブジェクトの toString に頼らない；
   * 収めるのは正規化した写し {id, role, text, props}（描画側 rx-views が読むのはこの四つだけ）。 */
  var EXPLAIN_KINDS = { disease: 1, body: 1, topic: 1 };
  var EXPLAIN_ROLES = { '機序': 1, '症状のつながり': 1, '臨床の筋道': 1, '心理職': 1 };
  function own(map, key) { return typeof key === 'string' && Object.prototype.hasOwnProperty.call(map, key); }
  function strOf(x) { return typeof x === 'string' ? x : (typeof x === 'number' && isFinite(x)) ? String(x) : ''; }
  function indexExplain(ix, c) {
    if (c.explain == null) return;
    var cid = strOf(c.id);
    if (!Array.isArray(c.explain)) { ix.diag.push(cid + ': explain が配列でない'); return; }
    var kind = strOf(c.kind);
    if (!own(EXPLAIN_KINDS, kind)) { ix.diag.push(cid + ': ' + (kind || '?') + ' のカードに讲解块は掛けられない'); return; }
    var mine = cardProps(c), kept = [];
    c.explain.forEach(function (b, i) {
      var bid = (b && strOf(b.id)) || (cid + ' の讲解块 ' + (i + 1));
      if (!b || typeof b !== 'object' || typeof b.text !== 'string' || !b.text.trim()) { ix.diag.push(bid + ': 本文が無い'); return; }
      if (b.props != null && !Array.isArray(b.props)) { ix.diag.push(bid + ': props が配列でない'); return; }
      var props = arr(b.props).map(strOf);
      var bad = props.filter(function (pid) { return !pid || !own(ix.props, pid) || mine.indexOf(pid) < 0; });
      if (bad.length) { ix.diag.push(bid + ': 命題 ' + bad.map(function (x) { return x || '?'; }).join('・') + ' がこのカードに無い'); return; }
      var role = strOf(b.role);
      if (!own(EXPLAIN_ROLES, role)) ix.diag.push(bid + ': role「' + role + '」は四値にない');
      kept.push({ id: bid, role: role, text: b.text, props: props });
    });
    if (kept.length) ix.explain[cid] = kept;
  }

  function orderOf(L) {
    var o = arr(L.order);
    return o.length ? o : arr(L.cards).map(function (c) { return c && c.id; }).filter(Boolean);
  }

  /* 卡片里挂的全部命题（各 kind 的字段形状不同，统一取出，保持出现顺序、去重） */
  function cardProps(c) {
    var out = [];
    function add(list) { arr(list).forEach(function (p) { if (typeof p === 'string' && out.indexOf(p) < 0) out.push(p); }); }
    add(c.props);
    arr(c.fields).forEach(function (f) { add(f && f.props); });
    arr(c.rows).forEach(function (r) { add(r && r.props); });
    arr(c.blocks).forEach(function (b) { add(b && b.props); });
    add(c.answers);
    return out;
  }

  /* 命题首次出现的卡片（三栏只在这里展开，E-13）＝按 order 第一张挂着它的卡 */
  function firstCardOf(ix, pid) { var l = ix.propCards[pid]; return l && l.length ? l[0] : null; }

  /* ---------- 出题：选项乱序・判定・逐肢反馈 ---------- */

  /* 选项每次呈现都重新乱序（数据里正肢常在第 1 位）。返回原选项下标的排列。 */
  function shuffledOrder(n, rng) {
    var r = rng || Math.random, o = [];
    for (var i = 0; i < n; i++) o.push(i);
    for (var j = n - 1; j > 0; j--) { var k = Math.floor(r() * (j + 1)); var t = o[j]; o[j] = o[k]; o[k] = t; }
    return o;
  }

  function correctIdx(q) {
    var out = [];
    arr(q.options).forEach(function (o, i) { if (o && o.correct) out.push(i); });
    return out;
  }

  /* 判定只看原选项的 correct：选中的集合恰等于正解集合才算对（「2 つ選べ」两个都对才算对） */
  function judge(q, picked) {
    var want = correctIdx(q), got = arr(picked).slice().sort(function (a, b) { return a - b; });
    if (want.length !== got.length) return false;
    for (var i = 0; i < want.length; i++) if (want[i] !== got[i]) return false;
    return true;
  }

  /* 逐肢反馈：判定・誤りの箇所・正しくは・篡改型・根拠（命题全文与所在卡片）。全部由选项挂的命题／变体推出。
   * 正肢文可与命题文不同，反馈显示命题全文。术语型错误肢不挂变体，「正しくは」取 why。 */
  function optionFeedback(ix, q, i) {
    var o = arr(q.options)[i] || {};
    var pe = o.prop && ix.props[o.prop];
    var ve = o.variant && ix.variants[o.variant];
    var v = ve ? ve.variant : null;
    return {
      correct: !!o.correct,
      text: o.text || '',
      propId: pe ? pe.prop.id : null,
      propText: pe ? pe.prop.text : null,
      cardId: pe ? firstCardOf(ix, pe.prop.id) : null,
      wrong: (!o.correct && v && v.wrong && (o.text || '').indexOf(v.wrong) >= 0) ? v.wrong : null,
      fix: o.correct ? null : (v && v.correct) || o.why || null,
      tamper: (!o.correct && v && v.tamper) ? { code: v.tamper, name: ix.tamper[v.tamper] || v.tamper } : null
    };
  }

  /* 题目各部分的呈现顺序：国试事例题＝事例→設問→選択肢 */
  function questionParts(q) {
    var parts = [];
    if (q.case) parts.push('case');
    parts.push('stem');
    parts.push('options');
    return parts;
  }

  /* ---------- 命题级间隔复习（规范 §3.5） ----------
   * 答错，或答对但「自信なし」→ 当天再出（短间隔）；隔天以上的两次有把握答对＝掌握；
   * 掌握后间隔按 INTERVALS 逐级拉长（只在到期日及之后答对才升级）；错一次回落。答对一次不移出错题本。 */
  var INTERVALS = [1, 3, 7, 14, 30];
  function dayIndex(d) { d = d || new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }
  function schedUpdate(prev, ok, unsure, today) {
    var s = { box: 0, due: today, streak: 0, lastOkDay: null, mastered: false, wrong: 0, unsure: 0, seen: 0 };
    if (isObj(prev)) Object.keys(s).forEach(function (k) { if (prev[k] !== undefined) s[k] = prev[k]; });
    s.seen++;
    if (!ok || unsure) {
      if (!ok) s.wrong++; else s.unsure++;
      s.box = 0; s.streak = 0; s.mastered = false; s.due = today;
      return s;
    }
    if (s.mastered) {
      if (today >= s.due) { s.box = Math.min(s.box + 1, INTERVALS.length - 1); s.due = today + INTERVALS[s.box]; s.lastOkDay = today; }
      return s;
    }
    if (s.lastOkDay === null || today - s.lastOkDay >= 1) { s.streak++; s.lastOkDay = today; }
    if (s.streak >= 2) { s.mastered = true; s.box = 0; s.due = today + INTERVALS[0]; }
    else s.due = today + 1;
    return s;
  }
  function status(s) { return !s ? 'new' : (s.mastered ? 'mastered' : 'learning'); }

  /* 今日该复习的命题：到期（due≤today）且仍在索引中的（退役命题不进队列，状态保留）。
   * 期末前 14 天起冲刺排序：★★★ ＞ 真题陈述 ＞ 个人重点 ＞ 其余；平时按到期日、再按重要度。 */
  function dueQueue(ix, sched, today, opt) {
    opt = opt || {};
    var props = (sched && sched.props) || {}, out = [];
    Object.keys(props).forEach(function (pid) { var st = props[pid]; if (ix.props[pid] && st && st.due <= today) out.push(pid); });
    var sprint = typeof opt.examDay === 'number' && opt.examDay - today <= 14 && opt.examDay >= today;
    var quiz = opt.quizStmts || {}, mine = opt.personal || {};
    function rank(pid) {
      if (!sprint) return 0;
      if ((ix.props[pid].prop.imp | 0) >= 3) return 0;
      if (quiz[pid]) return 1;
      if (mine[pid]) return 2;
      return 3;
    }
    out.sort(function (a, b) {
      return rank(a) - rank(b) || props[a].due - props[b].due || (ix.props[b].prop.imp | 0) - (ix.props[a].prop.imp | 0) || (a < b ? -1 : 1);
    });
    return { list: out, sprint: sprint };
  }

  /* 每回掌握度：覚えた・学習中・未着手 */
  function mastery(L, sched) {
    var props = (sched && sched.props) || {}, m = { mastered: 0, learning: 0, new: 0 };
    arr(L.props).forEach(function (p) { if (p && p.id) m[status(props[p.id])]++; });
    return m;
  }

  /* 篡改型统计：最常中招的几个型（按答错次数） */
  function topTamper(stats, n) {
    var by = (stats && stats.byTamper) || {};
    return Object.keys(by).sort(function (a, b) { return by[b] - by[a] || (a < b ? -1 : 1); }).slice(0, n || 3)
      .map(function (k) { return { code: k, n: by[k] }; });
  }

  return { CONTRACT: CONTRACT, validate: validate, buildIndex: buildIndex, orderOf: orderOf,
           INTERVALS: INTERVALS, dayIndex: dayIndex, schedUpdate: schedUpdate, status: status,
           dueQueue: dueQueue, mastery: mastery, topTamper: topTamper,
           cardProps: cardProps, firstCardOf: firstCardOf,
           shuffledOrder: shuffledOrder, correctIdx: correctIdx, judge: judge,
           optionFeedback: optionFeedback, questionParts: questionParts };
})();
