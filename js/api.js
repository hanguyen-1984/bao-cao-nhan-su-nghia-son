/**
 * Kết nối tới Apps Script Web App. Nếu chưa cấu hình API_URL thì dùng backend DEMO (js/demo.js).
 * Gửi POST dạng text/plain để trình duyệt không phát sinh preflight CORS.
 */
var API = (function () {
  'use strict';
  var cfg = window.NS_CONFIG || {};
  var demo = !cfg.API_URL;

  function check(res) {
    if (!res || !res.ok) {
      var msg = (res && res.error) || 'Lỗi không xác định';
      var e = new Error(msg.replace(/^AUTH:\s*/, ''));
      if (/^AUTH:/.test(msg)) e.auth = true;
      throw e;
    }
    return res;
  }

  function call(action, payload) {
    var body = Object.assign({ action: action }, payload || {});
    if (demo) {
      return new Promise(function (resolve) { setTimeout(function () { resolve(Demo.handle(JSON.parse(JSON.stringify(body)))); }, 120); }).then(check);
    }
    return fetch(cfg.API_URL, { method: 'POST', body: JSON.stringify(body), redirect: 'follow' })
      .then(function (r) {
        if (!r.ok) throw new Error('Máy chủ trả lỗi ' + r.status + '. Kiểm tra lại API_URL hoặc quyền truy cập Web App.');
        return r.json();
      }, function () {
        throw new Error('Không kết nối được máy chủ. Kiểm tra mạng hoặc API_URL trong js/config.js.');
      })
      .then(check);
  }

  return { call: call, demo: demo };
})();
