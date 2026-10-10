// Builds page script. It does four things:
//   1. Opens and closes the cards (packages, templates, steps and questions).
//   2. Fades things in as they scroll into view, and counts the prices up.
//   3. Runs the add-on dropdown.
//   4. Opens a card straight away if the link has its name in it (builds.html#online-store).
// Without JavaScript the page still works: every card shows open, and the add-ons show as a table.

(function () {
  'use strict';

  // This script belongs to the builds page only. If it is ever loaded on another page by mistake, it does nothing.
  if (!document.documentElement.classList.contains('page-builds')) { return; }

  // Some people tell their phone or computer they want less movement. We respect that.
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Small helper to find an element by its id.
  function byId(id) { return document.getElementById(id); }

  // ---------------------------------------------------------------------
  // 1. Give each piece inside a card a number, so it can slide in one after another.
  //    The CSS reads the number as --i and multiplies it into a delay.
  // ---------------------------------------------------------------------
  function numberChildren(parent) {
    Array.prototype.forEach.call(parent.children, function (child, i) {
      child.style.setProperty('--i', i);
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.fold-body, .ticks, .timeline, .term ol, .term ul'), numberChildren);

  // ---------------------------------------------------------------------
  // 2. Open and close the cards.
  // ---------------------------------------------------------------------
  function setOpen(card, open) {
    card.classList.toggle('is-open', open);
    var button = card.querySelector('.fold-toggle');
    if (button) { button.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  }

  Array.prototype.forEach.call(document.querySelectorAll('.fold-card'), function (card) {
    var button = card.querySelector('.fold-toggle');
    if (!button) { return; }
    button.addEventListener('click', function () {
      var willOpen = !card.classList.contains('is-open');

      // In the steps and the questions only one row stays open at a time, to keep the list tidy.
      // The packages and templates can stay open together, so people can compare them.
      var list = card.closest('.rows');
      if (willOpen && list) {
        Array.prototype.forEach.call(list.querySelectorAll('.fold-card.is-open'), function (other) {
          if (other !== card) { setOpen(other, false); }
        });
      }
      setOpen(card, willOpen);
    });
  });

  // If the address ends in a card's id, open that card (for example builds.html#online-store).
  if (location.hash.length > 1) {
    try {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target && target.classList.contains('fold-card')) { setOpen(target, true); }
    } catch (e) { /* a strange address: ignore it */ }
  }

  // ---------------------------------------------------------------------
  // 3. Count the prices up from zero when a card scrolls into view.
  // ---------------------------------------------------------------------
  function countUp(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-count]'), function (el) {
      var end = Number(el.getAttribute('data-count'));
      if (reduceMotion) { el.textContent = end; return; }
      var duration = 1100;
      var start = null;
      function frame(now) {
        if (start === null) { start = now; }
        var t = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - t, 3);          // starts fast, slows down at the end
        el.textContent = Math.round(end * eased);
        if (t < 1) { requestAnimationFrame(frame); }
      }
      el.textContent = '0';
      requestAnimationFrame(frame);
    });
  }

  // ---------------------------------------------------------------------
  // 4. Add-on dropdown. It is made by hand so it matches the site, and it works with the keyboard:
  //    Up and Down move, Enter or Space picks, Escape closes, Home and End jump to the ends.
  // ---------------------------------------------------------------------
  var addon = byId('addon');
  var dd = byId('dd');
  var button = byId('dd-button');
  var list = byId('dd-list');
  var valueText = byId('dd-value');
  var panel = byId('addon-panel');
  var mailLink = byId('addon-link');

  if (addon && dd && button && list && valueText && panel && mailLink) {
    // The dropdown starts hidden in the HTML. It only appears when JavaScript works.
    addon.hidden = false;

    // The email address is typed once, in the HTML link. We keep everything before the "?"
    // and add a subject line that names the add-on.
    var mailBase = mailLink.getAttribute('href').split('?')[0];
    var options = Array.prototype.slice.call(list.querySelectorAll('[role="option"]'));
    var activeIndex = -1;    // the row the keyboard or mouse is on
    var selectedIndex = -1;  // the row that was picked

    // Make an element with some text. textContent is used on purpose, because it can never run pasted code.
    function makeLine(tag, className, text) {
      var el = document.createElement(tag);
      if (className) { el.className = className; }
      el.textContent = text;
      return el;
    }

    // Replay the small slide-in every time the box changes.
    function playSwap() {
      panel.classList.remove('swap');
      void panel.offsetWidth;            // forces the browser to notice the change, so the animation restarts
      panel.classList.add('swap');
    }

    function showHint() {
      panel.replaceChildren(makeLine('p', 'addon-hint', 'Pick an add-on to see the price, the extra time and what it includes.'));
    }

    function showAddon(option) {
      var name = option.getAttribute('data-name');
      mailLink.setAttribute('href', mailBase + '?subject=' + encodeURIComponent('Website quote: ' + name));
      mailLink.textContent = 'Ask about this add-on';
      panel.replaceChildren(
        makeLine('p', 'addon-title', name),
        makeLine('p', 'addon-facts', option.getAttribute('data-price') + ', ' + option.getAttribute('data-time')),
        makeLine('p', 'addon-text', option.getAttribute('data-text')),
        mailLink
      );
      playSwap();
    }

    function setActive(index) {
      activeIndex = Math.max(0, Math.min(options.length - 1, index));
      options.forEach(function (option, i) { option.classList.toggle('is-active', i === activeIndex); });
      list.setAttribute('aria-activedescendant', options[activeIndex].id);
      options[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    function openList() {
      dd.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
      list.focus({ preventScroll: true });
      setActive(selectedIndex >= 0 ? selectedIndex : 0);
    }

    function closeList(returnFocus) {
      dd.classList.remove('open');
      button.setAttribute('aria-expanded', 'false');
      list.removeAttribute('aria-activedescendant');
      options.forEach(function (option) { option.classList.remove('is-active'); });
      if (returnFocus) { button.focus({ preventScroll: true }); }
    }

    function choose(index) {
      selectedIndex = index;
      options.forEach(function (option, i) { option.setAttribute('aria-selected', i === index ? 'true' : 'false'); });
      valueText.textContent = options[index].getAttribute('data-name');
      closeList(true);
      showAddon(options[index]);
    }

    button.addEventListener('click', function () {
      if (dd.classList.contains('open')) { closeList(false); } else { openList(); }
    });

    // Arrow keys on the closed button also open the list.
    button.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openList(); }
    });

    list.addEventListener('keydown', function (e) {
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); setActive(activeIndex + 1); break;
        case 'ArrowUp':   e.preventDefault(); setActive(activeIndex - 1); break;
        case 'Home':      e.preventDefault(); setActive(0); break;
        case 'End':       e.preventDefault(); setActive(options.length - 1); break;
        case 'Enter':
        case ' ':         e.preventDefault(); choose(activeIndex); break;
        case 'Escape':    e.preventDefault(); closeList(true); break;
        case 'Tab':       closeList(false); break;
      }
    });

    // Keep focus inside the list while the mouse is on it, so clicking a row never closes the list first.
    list.addEventListener('mousedown', function (e) { e.preventDefault(); });

    options.forEach(function (option, i) {
      option.addEventListener('mousemove', function () { if (activeIndex !== i) { setActive(i); } });
      option.addEventListener('click', function () { choose(i); });
    });

    // Tapping anywhere else closes the list.
    document.addEventListener('click', function (e) {
      if (!dd.contains(e.target)) { closeList(false); }
    });

    showHint();
  }

  // ---------------------------------------------------------------------
  // 5. Fade things in as they scroll into view. This runs last, so the dropdown (which starts hidden) is already showing.
  // ---------------------------------------------------------------------
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  function show(el) {
    el.classList.add('in');
    countUp(el);
  }

  if (!('IntersectionObserver' in window)) {
    // Very old browser: just show everything.
    reveals.forEach(show);
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          show(entry.target);
          observer.unobserve(entry.target);   // only once
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { observer.observe(el); });
  }
})();
