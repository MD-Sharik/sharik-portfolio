/* Consent-first GA4. No Google request is made until explicit acceptance. */
(function initAnalytics(cfg) {
  'use strict';
  if (!cfg || !Array.isArray(cfg.hosts) || cfg.hosts.indexOf(location.hostname) === -1 ||
      (cfg.cookiePath && location.pathname.indexOf(cfg.cookiePath) !== 0)) return;
  if (window.__siteAnalyticsConsent || !/^G-[A-Z0-9]+$/.test(cfg.id) || cfg.id === 'G-PENDING') return;
  window.__siteAnalyticsConsent = true;
  var id = cfg.id, key = 'site-ga-consent-v1:' + id;
  var prefix = 'site' + id.replace(/[^A-Z0-9]/g, ''), cookiePath = cfg.cookiePath || '/';
  var layer = 'siteAnalyticsLayer', enabled = false, loaded = false, lastPath = '', ui, analyticsFrame = null, frameReady = false;
  var maxAge = 180 * 24 * 60 * 60 * 1000;
  window['ga-disable-' + id] = true;
  function tag() { (window[layer] = window[layer] || []).push(arguments); }
  function cleanReferrer() { try { return new URL(document.referrer).origin; } catch (_) { return ''; } }
  function pageview() {
    if (!enabled) return;
    var path = location.pathname;
    if (path === lastPath) return;
    if (cfg.cmp && (!analyticsFrame || !frameReady)) return;
    lastPath = path;
    var page = {send_to: id, page_location: location.origin + path,
      page_referrer: cleanReferrer(), page_title: cfg.title};
    if (cfg.cmp) analyticsFrame.contentWindow.postMessage({kind: 'consented-pageview', page: page}, location.origin);
    else tag('event', 'page_view', page);
  }
  function clearCookies() {
    document.cookie.split(';').forEach(function (entry) {
      var name = entry.split('=')[0].trim();
      if (name !== prefix + '_ga' && name !== prefix + '_ga_' + id.slice(2)) return;
      var parts = location.hostname.split('.');
      var paths = ['/'];
      var pathParts = location.pathname.split('/').filter(Boolean), current = '';
      pathParts.forEach(function (p) { current += '/' + p; paths.push(current, current + '/'); });
      paths.forEach(function (path) {
        var cookie = name + '=; Max-Age=0; path=' + path + '; SameSite=Lax';
        document.cookie = cookie;
        for (var i = 0; i < parts.length - 1; i++) document.cookie = cookie + '; domain=.' + parts.slice(i).join('.');
      });
    });
  }
  function setEnabled(allow) {
    var wasEnabled = enabled;
    enabled = allow === true;
    window['ga-disable-' + id] = !enabled;
    if (!enabled) {
      lastPath = '';
      if (cfg.cmp) {
        if (analyticsFrame) {
          try {
            analyticsFrame.contentWindow['ga-disable-' + id] = true;
            if (typeof analyticsFrame.contentWindow.stopConsentedAnalytics === 'function') analyticsFrame.contentWindow.stopConsentedAnalytics();
          } catch (_) {}
          analyticsFrame.remove();
        }
        analyticsFrame = null; frameReady = false; loaded = false;
      }
      if (!cfg.cmp && loaded && wasEnabled) tag('consent', 'update', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
      clearCookies();
      return;
    }
    if (cfg.cmp) {
      if (!loaded) { loaded = true; createIsolatedFrame(); }
      else pageview();
      return;
    }
    if (!loaded) {
      loaded = true;
      tag('consent', 'default', {analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
      tag('set', 'ads_data_redaction', true);
      tag('set', 'url_passthrough', false);
      tag('set', {send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, page_location: location.origin + location.pathname, page_referrer: cleanReferrer(), page_title: cfg.title, cookie_domain: 'none', cookie_prefix: prefix, cookie_path: cookiePath, cookie_expires: 15552000, cookie_update: false, cookie_flags: 'SameSite=Lax;Secure', ignore_referrer: true, user_id: null});
      tag('js', new Date());
      tag('config', id, {send_page_view: false, allow_google_signals: false,
        allow_ad_personalization_signals: false, cookie_domain: 'none', cookie_prefix: prefix, cookie_path: cookiePath, cookie_expires: 15552000,
        cookie_update: false, cookie_flags: 'SameSite=Lax;Secure',
        page_location: location.origin + location.pathname, page_referrer: cleanReferrer(), page_title: cfg.title,
        ignore_referrer: true, user_id: null});
      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id) + '&l=' + layer;
      script.referrerPolicy = 'origin';
      document.head.appendChild(script);
    } else if (!wasEnabled) {
      tag('consent', 'update', {analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
    }
    pageview();
  }
  // The existing CMP can update global Google consent. Keep this site's GA runtime
  // in its own browsing context rather than changing the site's advertising consent.
  function createIsolatedFrame() {
    var frame = document.createElement('iframe');
    analyticsFrame = frame; frame.hidden = true; frame.title = 'Consent-controlled website analytics';
    frame.referrerPolicy = 'origin';
    frame.onload = function () { if (analyticsFrame !== frame || !enabled) return; frameReady = true; pageview(); };
    frame.src = cfg.frameUrl;
    document.body.appendChild(frame);
  }
  function readChoice() {
    try { var value = JSON.parse(localStorage.getItem(key));
      if (value && typeof value.allow === 'boolean' && Date.now() - value.at >= 0 && Date.now() - value.at < maxAge) return value.allow;
    } catch (_) {}
    return null;
  }
  function saveChoice(allow) {
    try { localStorage.setItem(key, JSON.stringify({allow: allow, at: Date.now()})); } catch (_) {}
    setEnabled(allow);
    if (ui) ui.banner.hidden = true;
  }
  function render() {
    var host = document.createElement('div');
    host.id = 'site-analytics-consent';
    var root = host.attachShadow({mode: 'open'});
    root.innerHTML = '<style>:host{all:initial;font-family:Arial,sans-serif;color:#17212b;font-size:14px;line-height:1.5}*{box-sizing:border-box}[hidden]{display:none!important}button,a{font:inherit}button{min-height:44px;cursor:pointer;border:1px solid #53616f;border-radius:7px;padding:8px 15px;background:#fff;color:#17212b}button:hover{background:#edf1f5}button:focus-visible,a:focus-visible{outline:3px solid #1261c9;outline-offset:3px}#settings{position:fixed;bottom:12px;left:12px;z-index:2147483645;box-shadow:0 2px 10px #0002}section{position:fixed;left:12px;bottom:65px;width:400px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 90px);overflow:auto;background:#fff;border:1px solid #53616f;border-radius:12px;padding:18px;box-shadow:0 6px 28px #0003;z-index:2147483646}h2{font:700 17px/1.4 Arial,sans-serif;margin:0 0 8px}p{margin:0 0 12px}.actions{display:flex;flex-wrap:wrap;gap:10px}a{color:#064b9b}dialog{color:#17212b;background:#fff;border:1px solid #53616f;border-radius:12px;width:560px;max-width:calc(100vw - 24px);max-height:85dvh;padding:22px;font:14px/1.6 Arial,sans-serif}dialog::backdrop{background:#0007}#notice{margin-top:12px;background:none;border:0;padding:4px 0;text-decoration:underline;color:#064b9b}small{display:block;margin-bottom:12px}</style>' +
      '<button id="settings" type="button">Analytics privacy</button>' +
      '<section id="banner" aria-labelledby="consent-title"><h2 id="consent-title" tabindex="-1">Allow Analytics?</h2><p>We use it to understand site visits. Analytics stays off unless you accept. You can change your choice at any time.</p><div class="actions"><button id="accept" type="button">Accept</button><button id="reject" type="button">Reject</button></div><button id="notice" type="button">Read the analytics privacy notice</button></section>' +
      '<dialog aria-labelledby="privacy-title"><h2 id="privacy-title">Website analytics privacy</h2><p>This website uses Google Analytics only after you accept. Google may process a pseudonymous cookie identifier, page paths, browser and device information, approximate location, and visit times to report how this website is used.</p><p>Our analytics code removes query strings and URL fragments, sends only the origin of referring websites, and uses a fixed site title. It does not collect form entries, uploaded files, or submitted content. Advertising storage, Google signals, ad user data, and ad personalization are disabled.</p>' +
      '<p>' + (cfg.cmp ? 'Your consent choice is managed by the existing Ezoic consent manager. Use its privacy controls to change or withdraw consent. Google Analytics stays off wherever explicit consent cannot be confirmed. Analytics cookies set by this integration expire after up to 180 days.' : 'Your choice is stored on this website for up to 180 days. Analytics cookies expire after up to 180 days. Choose Reject to stop future Analytics measurement and remove this site\'s accessible GA cookies.') + ' This cannot erase data already sent to Google.</p>' +
      '<p>Google processes data under its <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>, which includes information about international processing. Existing site services and their own privacy notices are unchanged by this Analytics choice.</p><small id="cmp-note" hidden>Analytics consent on this site is managed by the existing Ezoic consent manager. Use its privacy controls to change consent. Where explicit Analytics consent cannot be confirmed, Google Analytics stays off.</small><button id="close" type="button">Close</button></dialog>';
    document.body.appendChild(host);
    ui = {banner: root.querySelector('#banner'), dialog: root.querySelector('dialog')};
    root.querySelector('#accept').onclick = function () { saveChoice(true); };
    root.querySelector('#reject').onclick = function () { saveChoice(false); };
    root.querySelector('#notice').onclick = function () { ui.dialog.showModal(); };
    root.querySelector('#close').onclick = function () { ui.dialog.close(); };
    root.querySelector('#settings').onclick = function () {
      if (cfg.cmp) ui.dialog.showModal();
      else { ui.banner.hidden = !ui.banner.hidden; if (!ui.banner.hidden) root.querySelector('h2').focus(); }
    };
    if (cfg.cmp) { ui.banner.hidden = true; root.querySelector('#cmp-note').hidden = false; }
  }
  function connectCMP() {
    var attempts = 0;
    function connect() {
      if (typeof window.__tcfapi !== 'function') { if (++attempts < 40) setTimeout(connect, 250); return; }
      window.__tcfapi('addEventListener', 2, function (data, success) {
        var final = data && (data.eventStatus === 'tcloaded' || data.eventStatus === 'useractioncomplete');
        var explicitScope = data && (data.gdprApplies === true || data.eventStatus === 'useractioncomplete');
        var allow = success === true && final && explicitScope && data.cmpStatus === 'loaded' &&
          data.purpose && data.purpose.consents && data.purpose.consents[1] === true && data.purpose.consents[8] === true &&
          data.vendor && data.vendor.consents && data.vendor.consents[755] === true;
        setEnabled(allow === true);
      });
    }
    connect();
  }
  function start() {
    render();
    if (cfg.cmp) connectCMP();
    else { var choice = readChoice(); ui.banner.hidden = choice !== null; setEnabled(choice === true); }
    ['pushState', 'replaceState'].forEach(function (method) {
      var original = history[method];
      history[method] = function () { var result = original.apply(this, arguments); pageview(); return result; };
    });
    window.addEventListener('popstate', pageview);
    window.addEventListener('storage', function (event) {
      if (cfg.cmp || (event.key !== key && event.key !== null)) return;
      var choice = readChoice(); setEnabled(choice === true); ui.banner.hidden = choice !== null;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})({"id": "G-B8L4L3HPL8", "title": "Sharik", "cmp": false, "cookiePath": "/", "hosts": ["sharik.in"], "frameUrl": null});
