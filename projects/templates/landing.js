/* Landing page template: live open/closed status from the hours list, and the mobile call bar. */
(function () {
  var list = document.getElementById('hours'), out = document.getElementById('open-status');
  if (list && out) {
    var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    var tz = list.getAttribute('data-tz') || undefined;       // e.g. "America/Chicago". Empty = visitor's own clock.
    var mins = function (s) { var p = s.split(':'); return +p[0] * 60 + +p[1]; };
    var fmt = function (s) { var p = s.split(':'), h = +p[0], ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + (p[1] === '00' ? '' : ':' + p[1]) + ' ' + ap; };
    var parts = function () {
      var opts = { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
      try { return new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: tz }, opts)).formatToParts(new Date()); }
      catch (e) { return new Intl.DateTimeFormat('en-US', opts).formatToParts(new Date()); }
    };
    var tick = function () {
      var o = {}; parts().forEach(function (p) { o[p.type] = p.value; });
      var day = days[o.weekday], now = (+o.hour % 24) * 60 + +o.minute, open = false, msg = '';
      Array.prototype.forEach.call(list.children, function (r) {
        r.removeAttribute('aria-current');
        if (+r.dataset.day !== day) return;
        r.setAttribute('aria-current', 'date');
        if (!r.dataset.open) { msg = 'Closed today'; return; }
        var a = mins(r.dataset.open), b = mins(r.dataset.close);
        if (now >= a && now < b) { open = true; msg = 'Open now, closes ' + fmt(r.dataset.close); }
        else if (now < a) msg = 'Closed, opens today at ' + fmt(r.dataset.open);
        else msg = 'Closed for today';
      });
      out.textContent = msg; out.classList.toggle('is-open', open);
    };
    tick(); setInterval(tick, 60000);
  }

  var bar = document.getElementById('callbar'), hero = document.getElementById('hero-call'), end = document.getElementById('contact');
  if (bar && hero && end && 'IntersectionObserver' in window) {
    var past = false, atEnd = false, set = function () { bar.classList.toggle('show', past && !atEnd); };
    new IntersectionObserver(function (e) { past = !e[0].isIntersecting && e[0].boundingClientRect.top < 0; set(); }).observe(hero);
    new IntersectionObserver(function (e) { atEnd = e[0].isIntersecting; set(); }).observe(end);
  }
})();
