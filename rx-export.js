/* rx-export.js ― 新課の回のページの工具行（目次ボタンは renderRxLecture が先頭に入れる）。
 * 2026-10-15 の決定で「印刷する」「この回／このコース全体を Markdown で書き出す」を下ろした（作った内容を簡単に持ち出させない）。
 * ブラウザ自身の印刷（Cmd+P）は styles.css の @media print で一行の説明だけにする。
 * 学習データの書き出し／取り込み（panels.js の doExport・rx-views.js の rxExportState）は別物で、残している。
 * 部件はそのまま残す（index.html の読み込み順・sw.js の PARTS・部件一覧を動かさない）。 */
'use strict';

function rxLectureTools(Lc){ return el('div',{class:'rx-tools'}); }
