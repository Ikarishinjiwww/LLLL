/* quiz_envelope.js ― 真題層の封套（rx-quiz-envelope/1）の暗号化・復号の参照実装。
 * 配布脚本（quiz_crypto.py）は Playwright の無頭 Chromium にこのファイルを読み込ませて暗号化・往返テストを行う。
 * app 側（S1-c）は同じ関数をそのまま使うか、同じ手順で実装する（PBKDF2-SHA256 → AES-GCM-256、salt は課程固定、iv は配布ごと）。
 * classic script 前提：グローバル関数のみ、module 不使用。
 */
var RXQuizEnvelope = (function () {
  "use strict";
  function b64(bytes) {
    var s = "";
    var u = new Uint8Array(bytes);
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }
  function unb64(str) {
    var s = atob(str), u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  function deriveKey(passphrase, saltB64, iterations, extractable) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return crypto.subtle.deriveKey(
        { name: "PBKDF2", hash: "SHA-256", salt: unb64(saltB64), iterations: iterations },
        base, { name: "AES-GCM", length: 256 }, !!extractable, ["encrypt", "decrypt"]);
    });
  }
  // plaintextB64：明文 UTF-8 バイト列の base64。戻り値：封套オブジェクト
  function encrypt(course, plaintextB64, passphrase, saltB64, iterations, built, items) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(passphrase, saltB64, iterations, false).then(function (key) {
      return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, unb64(plaintextB64));
    }).then(function (ct) {
      return {
        schema: "rx-quiz-envelope/1", course: course,
        kdf: { name: "PBKDF2", hash: "SHA-256", iterations: iterations, salt: saltB64 },
        cipher: { name: "AES-GCM", iv: b64(iv) },
        built: built, items: items, ct: b64(ct)
      };
    });
  }
  // app の解錠と同じ手順：封套の kdf と cipher に従って鍵を導出し復号。GCM 検証に失敗すると reject（口令違い）
  function decryptWithKey(envelope, key) {
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(envelope.cipher.iv) }, key, unb64(envelope.ct)).then(function (pt) {
      return b64(pt);
    });
  }
  function decrypt(envelope, passphrase) {
    return deriveKey(passphrase, envelope.kdf.salt, envelope.kdf.iterations, false).then(function (key) {
      return decryptWithKey(envelope, key);
    });
  }
  return { encrypt: encrypt, decrypt: decrypt, deriveKey: deriveKey, decryptWithKey: decryptWithKey };
})();
