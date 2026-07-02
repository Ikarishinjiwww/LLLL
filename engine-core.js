/* ============================================================================
 * engine-core.js  ―  多课程刷题引擎 / 纯逻辑核心（无 DOM 依赖）
 * 版本: 1.0.0
 * 被 index.html 与 tests.html 共同引用（classic script, 可在 file:// 下加载）。
 * 设计原则: 全部为纯函数 + 可注入种子的 RNG。生产用真随机, 测试用固定种子。
 * 这里只有逻辑; 渲染(render)由 app 侧按题型注册表补齐。
 * ==========================================================================*/
(function (global) {
  'use strict';

  /* ---------- 0. 可注入种子的 RNG (mulberry32) ---------- */
  function makeRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // 生产用: 用 crypto 播种一个 mulberry32, 仍可序列化重放(若需要)
  function makeProdRng() {
    let seed;
    try {
      const buf = new Uint32Array(1);
      (global.crypto || global.msCrypto).getRandomValues(buf);
      seed = buf[0];
    } catch (e) { seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0; }
    return makeRng(seed);
  }

  /* ---------- 1. 基础: Fisher–Yates 洗牌(返回新数组, 不改原数组) ---------- */
  function shuffle(arr, rng) {
    const r = rng || Math.random;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- 2. 选项乱序(不变量2): 打乱 option 对象本身, 各自随身带 correct ----------
   * 返回新数组, 元素仍引用原 option 对象(携带其 correct 标记与文本)。
   * 无条件洗牌――不存在"按存储序显示"的路径。*/
  function shuffleOptions(options, rng) {
    return shuffle(options, rng);
  }

  /* ---------- 3. 选择题判分(不变量1): 只看被选对象的 correct, 与 index 无关 ---------- */
  function gradeChoice(selectedOption) {
    return !!(selectedOption && selectedOption.correct === true);
  }

  /* ---------- 4. 主观题百分比: 勾中数 / 要点总数 (返回 0..1 比例) ---------- */
  function subjectivePercent(checkedCount, totalRubric) {
    if (!totalRubric) return 0;
    const c = Math.max(0, Math.min(checkedCount, totalRubric));
    return c / totalRubric;
  }

  /* ---------- 5. 题型注册表(逻辑侧): grade / weaknessExtract / validateOne ----------
   * render 由 app 侧补。所有遍历都经此表, 未知 type 优雅跳过 + 告警(见 dispatch*)。*/
  const types = {
    choice: {
      // 作答结果 ans = { selectedOption } -> 是否正确
      grade: function (q, ans) {
        return gradeChoice(ans && ans.selectedOption);
      },
      // 错选时, 该题涉及的概念计入薄弱
      weaknessExtract: function (q, ans, correct) {
        if (correct) return [];
        return (q.concepts || []).slice();
      },
      validateOne: function (q) {
        const errs = [], warns = [];
        const opts = q.options || [];
        if (opts.length !== 4) errs.push('options 数 ≠ 4 (=' + opts.length + ')');
        const nCorrect = opts.filter(function (o) { return o && o.correct === true; }).length;
        if (nCorrect !== 1) errs.push('correct:true 数 ≠ 1 (=' + nCorrect + ')');
        if (opts.some(function (o) { return !o || typeof o.t !== 'string' || !o.t.trim(); })) errs.push('存在空 option 文本');
        ['explainShort', 'explainLong'].forEach(function (f) {
          if (!bilingualOk(q[f])) warns.push(f + ' 双语缺失');
        });
        return { errs: errs, warns: warns };
      }
    },
    subjective: {
      // 作答结果 ans = { checkedConcepts:[...], missedConcepts:[...] }
      grade: function (q, ans) {
        const total = (q.rubric || []).length;
        const hit = ans && ans.checkedConcepts ? ans.checkedConcepts.length : 0;
        return total > 0 && hit === total; // "全中"才算这题完全正确; 百分比另算
      },
      // 没勾中的要点, 按其 concept 计入薄弱
      weaknessExtract: function (q, ans) {
        if (ans && Array.isArray(ans.missedConcepts)) return ans.missedConcepts.slice();
        return [];
      },
      validateOne: function (q) {
        const errs = [], warns = [];
        const rubric = q.rubric || [];
        if (!rubric.length) errs.push('rubric 为空');
        if (rubric.some(function (r) { return !r || !r.concept; })) errs.push('存在缺 concept 的 rubric 条目');
        if (!bilingualOk(q.modelAnswer)) errs.push('modelAnswer 缺失/双语不全');
        if (!bilingualOk(q.explainLong)) warns.push('explainLong 双语缺失');
        rubric.forEach(function (r, i) {
          if (r && !bilingualOk(r.point)) warns.push('rubric[' + i + '].point 双语缺失');
        });
        // 主观题没有 explainShort 属正常, 不校验
        return { errs: errs, warns: warns };
      }
    }
  };

  function bilingualOk(v) { return v && typeof v.ja === 'string' && typeof v.zh === 'string' && v.ja.length > 0 && v.zh.length > 0; }

  // 遇未知 type 时统一处理: 返回 null 并把告警塞进 sink
  function typeHandler(type, sink) {
    if (types[type]) return types[type];
    if (sink) sink.push('未知 type: ' + type + '(已优雅跳过)');
    return null;
  }

  /* ---------- 6. 模拟考抽题 ----------
   * cfg = { total, minSubjective, floatCount }
   * 规则: 保底 minSubjective 道记述 + floatCount 个浮动名额(每个随机选/记述) + 其余补选择, 总数=total。
   * 然后整体打乱顺序(记述题散布进序列, 不分段)。
   * recentIds: 同会话刚做过的题, 抽题时降低权重(轻度, 不硬排除)。
   * 返回 { set:[...questions], counts:{choice,subjective}, shortfall:{...} }。*/
  function pickExamSet(questions, cfg, rng, recentIds) {
    const r = rng || Math.random;
    cfg = cfg || {};
    const total = cfg.total || 30;
    const minSubj = cfg.minSubjective != null ? cfg.minSubjective : 4;
    const floatN = cfg.floatCount != null ? cfg.floatCount : 1;
    const recent = new Set(recentIds || []);

    const subjPool = questions.filter(function (q) { return q.type === 'subjective'; });
    const choicePool = questions.filter(function (q) { return q.type === 'choice'; });

    // recency 轻度压权: 把"最近做过"的排到各自池子末尾(优先抽没做过的), 但不排除
    function deprio(pool) {
      const fresh = [], seen = [];
      pool.forEach(function (q) { (recent.has(q.id) ? seen : fresh).push(q); });
      return shuffle(fresh, r).concat(shuffle(seen, r));
    }
    const subjShuf = deprio(subjPool);
    const choiceShuf = deprio(choicePool);

    const used = new Set();
    const picked = [];
    function take(pool) {
      for (let i = 0; i < pool.length; i++) { if (!used.has(pool[i].id)) { used.add(pool[i].id); return pool[i]; } }
      return null;
    }
    const shortfall = { subjective: 0, choice: 0 };

    // 1) 保底记述
    let subjTaken = 0;
    for (let i = 0; i < minSubj; i++) { const q = take(subjShuf); if (q) { picked.push(q); subjTaken++; } else shortfall.subjective++; }

    // 2) 浮动名额: 每个随机选/记述(coin flip), 记述池空则退化为选择
    for (let i = 0; i < floatN; i++) {
      const wantSubj = r() < 0.5;
      let q = wantSubj ? take(subjShuf) : take(choiceShuf);
      if (!q) q = wantSubj ? take(choiceShuf) : take(subjShuf); // 该池空则换池
      if (q) picked.push(q);
    }

    // 3) 其余补选择, 凑到 total
    while (picked.length < total) {
      const q = take(choiceShuf) || take(subjShuf);
      if (!q) { shortfall.choice += (total - picked.length); break; }
      picked.push(q);
    }

    const set = shuffle(picked, r); // 整体打乱顺序 -> 记述散布, 不分段
    const counts = {
      choice: set.filter(function (q) { return q.type === 'choice'; }).length,
      subjective: set.filter(function (q) { return q.type === 'subjective'; }).length
    };
    return { set: set, counts: counts, shortfall: shortfall };
  }

  /* ---------- 7. 复习: 薄弱加权抽样(非日期驱动) ----------
   * weakness: { conceptName: count } 越大越该多出现; recentIds 降权; 可按 kai 过滤。
   * 已掌握(权重低)仍保留在池中(不退出), 错题/薄弱概念权重更高。*/
  function reviewSample(questions, opts, rng) {
    const r = rng || Math.random;
    opts = opts || {};
    const weakness = opts.weakness || {};
    const recent = new Set(opts.recentIds || []);
    const count = opts.count || 12;
    let pool = questions;
    if (opts.kai != null) pool = pool.filter(function (q) { return q.kai === opts.kai; });
    if (opts.onlyIds) { const s = new Set(opts.onlyIds); pool = pool.filter(function (q) { return s.has(q.id); }); }
    if (!pool.length) return [];

    function weightOf(q) {
      let w = 1;
      (q.concepts || []).forEach(function (c) { if (weakness[c]) w += weakness[c] * 2; }); // 薄弱概念加权
      (q.rubric || []).forEach(function (rb) { if (rb.concept && weakness[rb.concept]) w += weakness[rb.concept] * 2; });
      if (recent.has(q.id)) w *= 0.25; // recency 压权
      return Math.max(0.0001, w);
    }
    return weightedSampleWithoutReplacement(pool, count, weightOf, r);
  }

  function weightedSampleWithoutReplacement(pool, n, weightFn, rng) {
    const r = rng || Math.random;
    const items = pool.slice();
    const weights = items.map(weightFn);
    const out = [];
    n = Math.min(n, items.length);
    for (let k = 0; k < n; k++) {
      let totalW = 0; for (let i = 0; i < items.length; i++) totalW += weights[i];
      let x = r() * totalW, idx = 0;
      for (; idx < items.length; idx++) { x -= weights[idx]; if (x <= 0) break; }
      if (idx >= items.length) idx = items.length - 1;
      out.push(items[idx]);
      items.splice(idx, 1); weights.splice(idx, 1);
    }
    return out;
  }

  /* ---------- 8. 薄弱度两路汇总 ----------
   * answerLog: [{ id, type, correct, ans }] (ans 含主观题的 missedConcepts)
   * 返回 { concepts:{name:count}, byKai, byKind, byTopic, wrongIds, totals }。*/
  function aggregateWeakness(answerLog, byId) {
    const concepts = {}, byKai = {}, byKind = {}, byTopic = {};
    const wrongIds = [];
    let answered = 0, correct = 0;
    function bump(map, key) { if (key == null) return; map[key] = (map[key] || 0) + 1; }

    answerLog.forEach(function (entry) {
      const q = byId[entry.id]; if (!q) return;
      answered++;
      const h = types[q.type];
      const isCorrect = entry.correct === true;
      if (isCorrect) correct++;
      if (!isCorrect) {
        wrongIds.push(entry.id);
        bump(byKai, q.kai); bump(byKind, q.kind); bump(byTopic, q.topic);
      }
      if (h && typeof h.weaknessExtract === 'function') {
        const cs = h.weaknessExtract(q, entry.ans, isCorrect) || [];
        cs.forEach(function (c) { bump(concepts, c); });
      }
    });
    return {
      concepts: concepts, byKai: byKai, byKind: byKind, byTopic: byTopic,
      wrongIds: wrongIds, totals: { answered: answered, correct: correct }
    };
  }

  /* ---------- 9. 反向索引(答题与手册共享的基础设施, 加载时构建一次) ----------
   * 返回 byId / conceptToQuestions / kaiToQuestions / topicToQuestions / conceptMeta / 列表。*/
  function buildIndices(questions, concepts) {
    const byId = {}, conceptToQuestions = {}, kaiToQuestions = {}, topicToQuestions = {};
    const kaiSet = new Set(), topicSet = new Set();
    function push(map, key, id) { if (key == null) return; (map[key] = map[key] || []).push(id); }

    questions.forEach(function (q) {
      byId[q.id] = q;
      push(kaiToQuestions, q.kai, q.id); kaiSet.add(q.kai);
      push(topicToQuestions, q.topic, q.id); if (q.topic) topicSet.add(q.topic);
      const cset = new Set();
      (q.concepts || []).forEach(function (c) { cset.add(c); });
      (q.rubric || []).forEach(function (rb) { if (rb.concept) cset.add(rb.concept); });
      cset.forEach(function (c) { push(conceptToQuestions, c, q.id); });
    });

    const conceptMeta = {}; // name -> { origin, definition, exists }
    Object.keys(conceptToQuestions).forEach(function (name) {
      const def = concepts[name];
      conceptMeta[name] = def ? { origin: def.origin, definition: def.definition, exists: true }
        : { origin: null, definition: null, exists: false };
    });

    return {
      byId: byId,
      conceptToQuestions: conceptToQuestions,
      kaiToQuestions: kaiToQuestions,
      topicToQuestions: topicToQuestions,
      conceptMeta: conceptMeta,
      kais: Array.from(kaiSet).sort(function (a, b) { return a - b; }),
      topics: Array.from(topicSet).sort(),
      concepts: Object.keys(conceptToQuestions).sort()
    };
  }

  /* ---------- 10. 启动期内容校验 + 退化分布守卫 ----------
   * 返回 { errors:[{id,msg}], warnings:[{id,msg}], degraded:[{id,reason}],
   *        stats:{total,byKai,byType,conceptCount,dupIds},
   *        degeneracy:{ kai: {n,posDist,correctAvgLen,distractorAvgLen,lenDiff,maxPosShare,flags} },
   *        fatal:boolean }。*/
  function validateContent(questions, concepts) {
    const errors = [], warnings = [], degraded = [];
    const stats = { total: questions.length, byKai: {}, byType: {}, conceptCount: Object.keys(concepts).length, dupIds: [] };
    const seenIds = {};
    function bump(m, k) { if (k == null) return; m[k] = (m[k] || 0) + 1; }

    questions.forEach(function (q) {
      bump(stats.byKai, q.kai); bump(stats.byType, q.type);
      if (seenIds[q.id]) { stats.dupIds.push(q.id); warnings.push({ id: q.id, msg: 'id 重复(运行时首条胜出)' }); }
      seenIds[q.id] = true;

      const sink = [];
      const h = typeHandler(q.type, sink);
      sink.forEach(function (m) { warnings.push({ id: q.id, msg: m }); });
      if (h && typeof h.validateOne === 'function') {
        const v = h.validateOne(q);
        v.errs.forEach(function (m) { errors.push({ id: q.id, msg: m }); });
        v.warns.forEach(function (m) { warnings.push({ id: q.id, msg: m }); });
      }
      // 概念死链 -> warning + 该题追溯起源对缺失概念降级
      const cs = new Set();
      (q.concepts || []).forEach(function (c) { cs.add(c); });
      (q.rubric || []).forEach(function (rb) { if (rb.concept) cs.add(rb.concept); });
      cs.forEach(function (c) {
        if (!concepts[c]) { warnings.push({ id: q.id, msg: '概念未在 concepts.json: ' + c }); degraded.push({ id: q.id, reason: '追溯起源降级(缺概念 ' + c + ')' }); }
      });
      // 优雅降级清单: 缺 explainLong
      if (!bilingualOk(q.explainLong)) degraded.push({ id: q.id, reason: 'explainLong 缺失 → 展开区隐藏' });
    });

    // 退化分布守卫: 每个 kai 的正确项存储位置分布 + 正确项 vs 干扰项平均字数
    const degeneracy = {};
    stats.byKai && Object.keys(stats.byKai).forEach(function () {}); // noop
    const kais = Array.from(new Set(questions.map(function (q) { return q.kai; }))).sort(function (a, b) { return a - b; });
    kais.forEach(function (kai) {
      const items = questions.filter(function (q) { return q.kai === kai && q.type === 'choice'; });
      if (!items.length) return;
      const posDist = {}; let cLenSum = 0, cLenN = 0, dLenSum = 0, dLenN = 0;
      items.forEach(function (q) {
        (q.options || []).forEach(function (o, i) {
          if (o.correct) { posDist[i] = (posDist[i] || 0) + 1; cLenSum += (o.t || '').length; cLenN++; }
          else { dLenSum += (o.t || '').length; dLenN++; }
        });
      });
      const tot = Object.values(posDist).reduce(function (a, b) { return a + b; }, 0);
      const maxPosShare = tot ? Math.max.apply(null, Object.values(posDist)) / tot : 0;
      const correctAvgLen = cLenN ? cLenSum / cLenN : 0;
      const distractorAvgLen = dLenN ? dLenSum / dLenN : 0;
      const lenDiff = correctAvgLen - distractorAvgLen;
      const flags = [];
      if (maxPosShare >= 0.6) flags.push('位置退化: 正确项 ' + Math.round(maxPosShare * 100) + '% 集中在某一位置');
      if (lenDiff >= 5) flags.push('长度泄题: 正确项平均比干扰项长 ' + lenDiff.toFixed(1) + ' 字');
      degeneracy[kai] = {
        n: items.length, posDist: posDist, maxPosShare: maxPosShare,
        correctAvgLen: correctAvgLen, distractorAvgLen: distractorAvgLen, lenDiff: lenDiff, flags: flags
      };
    });

    return { errors: errors, warnings: warnings, degraded: degraded, stats: stats, degeneracy: degeneracy, fatal: errors.length > 0 };
  }

  /* ---------- 11. 进度导出/导入序列化 ----------
   * 导出默认"分享安全": 不含手写原始答案(除非 opts.includeRawAnswers)。
   * 含 courseId/schemaVersion/appVersion/时间戳 + 学习信号(对错/薄弱/分部错误率)。*/
  function serializeProgress(progress, meta, opts) {
    opts = opts || {};
    const out = {
      _kind: 'quiz-progress-export',
      courseId: meta.courseId,
      schemaVersion: meta.schemaVersion,
      appVersion: meta.appVersion,
      exportedAt: new Date().toISOString(),
      includesRawAnswers: !!opts.includeRawAnswers,
      // 学习信号(不可识别个人)
      seenIds: Object.keys(progress.seen || {}),
      wrongIds: Object.keys(progress.wrong || {}),
      weakness: progress.weakness || {},
      stats: progress.stats || {},
      // 完整进度(用于本地还原)。手写答案默认剥离。
      attempts: (progress.attempts || []).map(function (a) {
        const copy = { id: a.id, type: a.type, correct: a.correct, at: a.at };
        if (a.percent != null) copy.percent = a.percent;
        if (a.missedConcepts) copy.missedConcepts = a.missedConcepts;
        if (opts.includeRawAnswers && a.rawAnswer != null) copy.rawAnswer = a.rawAnswer;
        return copy;
      })
    };
    return out;
  }

  function deserializeProgress(obj) {
    if (!obj || obj._kind !== 'quiz-progress-export') throw new Error('不是有效的进度导出文件');
    const seen = {}, wrong = {};
    (obj.seenIds || []).forEach(function (id) { seen[id] = true; });
    (obj.wrongIds || []).forEach(function (id) { wrong[id] = true; });
    return {
      courseId: obj.courseId,
      schemaVersion: obj.schemaVersion,
      progress: {
        seen: seen, wrong: wrong,
        weakness: obj.weakness || {},
        stats: obj.stats || {},
        attempts: obj.attempts || []
      }
    };
  }

  /* ---------- export ---------- */
  global.QuizCore = {
    makeRng: makeRng, makeProdRng: makeProdRng, shuffle: shuffle,
    shuffleOptions: shuffleOptions, gradeChoice: gradeChoice, subjectivePercent: subjectivePercent,
    types: types, typeHandler: typeHandler,
    pickExamSet: pickExamSet, reviewSample: reviewSample, weightedSampleWithoutReplacement: weightedSampleWithoutReplacement,
    aggregateWeakness: aggregateWeakness, buildIndices: buildIndices, validateContent: validateContent,
    serializeProgress: serializeProgress, deserializeProgress: deserializeProgress,
    bilingualOk: bilingualOk,
    VERSION: '1.0.0'
  };

})(typeof window !== 'undefined' ? window : this);
