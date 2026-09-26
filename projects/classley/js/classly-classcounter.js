"use strict";
/* Class Counter screen. */

  let ccTab = 'mine';


  const ccCourse = id => DEMO_COURSES.find(c => c.id === id);

  const ccConfirmed = c => c.baseTotal + DEMO_CLASS_LOG.filter(e => e.courseId === c.id && e.status === 'confirmed').length;

  const ccPending = c => DEMO_CLASS_LOG.filter(e => e.courseId === c.id && e.status === 'pending').length;

  const ccToday = c => DEMO_CLASS_LOG.find(e => e.courseId === c.id && e.day === todayKey());

  const isTeacherOf = (c, id) => c.teacherId === id || c.secondaryIds.includes(id);

  const ccMine = () => classCourses().filter(c => isTeacherOf(c, currentUser.id));

  const isAutoConfirmed = e => e.status === 'confirmed' && e.decidedBy && e.decidedBy.auto;


  function canConfirm(user, e){
    if (e.status !== 'pending') return false;
    if (user.role === 'owner') return e.by.id !== user.id;
    if (user.role === 'admin') return e.by.id !== user.id && e.by.role !== 'owner';   // Admin confirms others, never their own
    return false;
  }

  const ccQueue = () => DEMO_CLASS_LOG.filter(e => canConfirm(currentUser, e)).sort((a, b) => a.at.localeCompare(b.at));


  function fmtTick(e){
    const t = new Date(e.at).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
    const day = e.day === todayKey() ? 'Today' : e.day === yesterdayKey() ? 'Yesterday'
      : new Date(e.day + 'T00:00').toLocaleDateString(undefined, { day:'numeric', month:'short' });
    return `${day}, ${t}`;
  }

  /* ---- actions (each is one API call in Phase 2) ---- */

  function tickToday(courseId){
    const c = ccCourse(courseId);
    if (!c || c.status !== 'active' || !isTeacherOf(c, currentUser.id)) return;   // only an assigned teacher (primary or secondary) can tick
    const existing = ccToday(c);
    if (existing && existing.status !== 'rejected') return;          // one tick per course per day
    if (existing) DEMO_CLASS_LOG.splice(DEMO_CLASS_LOG.indexOf(existing), 1);
    const auto = currentUser.role === 'owner';
    DEMO_CLASS_LOG.unshift({
      id:'t' + (++ccSeq), courseId, day:todayKey(), at:new Date().toISOString(),
      by:{ id:currentUser.id, name:currentUser.name, role:currentUser.role },
      status: auto ? 'confirmed' : 'pending',
      decidedBy: auto ? { name:'Owner', auto:true } : null
    });
    showToast(auto ? `Recorded: ${c.name}` : `Sent for confirmation: ${c.name}`);
  }

  function undoTick(courseId){
    const c = ccCourse(courseId), e = c && ccToday(c);
    if (!e || e.by.id !== currentUser.id || !(e.status === 'pending' || isAutoConfirmed(e))) return;
    DEMO_CLASS_LOG.splice(DEMO_CLASS_LOG.indexOf(e), 1);
    showToast('Tick removed');
  }

  function decide(entryId, status){
    const e = DEMO_CLASS_LOG.find(x => x.id === entryId);
    if (!e || !canConfirm(currentUser, e)) return null;
    e.status = status;
    e.decidedBy = { name:currentUser.name };
    return e;
  }

  /* ---- rendering ---- */

  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const CLOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.9"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const WARN_SVG  = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5v5.5M12 16.5v.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';


  function statusPill(e){
    if (!e) return '<span class="pill pill-muted">Not ticked today</span>';
    if (e.status === 'pending')   return '<span class="pill pill-warning">Pending</span>';
    if (e.status === 'confirmed') return '<span class="pill pill-success">Confirmed</span>';
    return '<span class="pill pill-danger">Rejected</span>';
  }


  function ccCardHTML(c){
    const e = ccToday(c), total = ccConfirmed(c), pend = ccPending(c);
    const pct = Math.min(100, Math.round(total / c.planned * 100));
    const covering = c.teacherId !== currentUser.id;                 // secondary teacher
    const mine = e && e.by.id === currentUser.id;
    const tickBtn = label => `<button type="button" class="btn btn-primary cc-tick" data-act="tick" data-course="${c.id}">${CHECK_SVG}<span>${label}</span></button>`;
    let action = '';
    if (!e){
      action = tickBtn("Mark today's class as taken");
    } else if (e.status === 'rejected'){
      action = `<div class="cc-status is-danger">${WARN_SVG}<div><strong>Not accepted by ${esc(e.decidedBy.name)}.</strong> If the class did happen, tick it again.</div></div>` + tickBtn('Tick again');
    } else if (!mine){
      const done = e.status === 'confirmed';
      action = `<div class="cc-status ${done ? 'is-success' : 'is-warning'}">${done ? CHECK_SVG : CLOCK_SVG}<div><strong>${esc(e.by.name)} already ticked today's class.</strong> ${done ? 'Counted in the total.' : 'Waiting for confirmation.'}</div></div>`;
    } else if (e.status === 'pending'){
      action = `<div class="cc-status is-warning">${CLOCK_SVG}<div><strong>Waiting for confirmation.</strong> Ticked ${esc(fmtTick(e))}. Not counted yet.</div>
        <button type="button" class="link-btn" data-act="undo" data-course="${c.id}">Undo</button></div>`;
    } else {
      const who = isAutoConfirmed(e) ? 'Recorded' : `Confirmed by ${esc(e.decidedBy.name)}`;
      action = `<div class="cc-status is-success">${CHECK_SVG}<div><strong>${who}.</strong> Counted in the total.</div>` +
        (isAutoConfirmed(e) && e.by.id === currentUser.id ? `<button type="button" class="link-btn" data-act="undo" data-course="${c.id}">Undo</button>` : '') + '</div>';
    }
    return `
      <article class="card cc-card" data-course="${c.id}" aria-label="${esc(c.name)}">
        <div class="cc-card-head">
          <div><h2>${esc(c.name)}${covering ? '<span class="mini-tag">Secondary</span>' : ''}</h2><p>${esc(c.batch)} · ${esc(c.schedule)}</p></div>
          ${statusPill(e)}
        </div>
        <div class="cc-count">
          <div class="cc-total" aria-live="polite">${total}</div>
          <div class="cc-count-meta"><span>classes taken</span><span>of ${c.planned}${pend ? ` · <b class="cc-pend">${pend} pending</b>` : ''}</span></div>
        </div>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${c.planned}" aria-valuenow="${total}" aria-label="Classes taken"><span style="width:${pct}%"></span></div>
        <div class="cc-action">${action}</div>
      </article>`;
  }


  function ccActivityHTML(){
    const rows = DEMO_CLASS_LOG.filter(e => e.by.id === currentUser.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
    if (!rows.length) return '<li class="cc-empty-line">No ticks yet. They will show up here.</li>';
    return rows.map(e => `<li class="recent-row"><div class="recent-main"><div class="recent-name">${esc(ccCourse(e.courseId).name)}</div>
      <div class="recent-meta">${esc(fmtTick(e))}${e.status === 'rejected' && e.decidedBy ? ' · rejected by ' + esc(e.decidedBy.name) : ''}</div></div>${statusPill(e)}</li>`).join('');
  }


  function ccQueueHTML(){
    const q = ccQueue();
    if (!q.length){
      return `<div class="cc-empty">${CHECK_SVG}<h2>Nothing to confirm</h2><p>Every tick you can approve has been handled.</p></div>`;
    }
    const bar = `<div class="cc-queue-bar"><p>${q.length} ${q.length === 1 ? 'tick is' : 'ticks are'} waiting for you.</p>
      <button type="button" class="btn btn-ghost btn-sm" data-act="confirm-all" aria-label="Confirm all ${q.length} ticks">Confirm all (${q.length})</button></div>`;
    return bar + '<ul class="cc-queue">' + q.map(e => {
      const c = ccCourse(e.courseId), total = ccConfirmed(c);
      return `<li class="card cc-q-item" data-entry="${e.id}">
        <div class="user-avatar">${esc(initials(e.by.name))}</div>
        <div class="cc-q-main">
          <div class="cc-q-title">${esc(c.name)}</div>
          <div class="cc-q-meta">${esc(e.by.name)} · ${esc(fmtTick(e))}</div>
          <div class="cc-q-count">Total ${total} <span aria-hidden="true">→</span><span class="visually-hidden">becomes</span> <strong>${total + 1}</strong></div>
        </div>
        <div class="cc-q-actions">
          <button type="button" class="btn btn-ghost btn-sm is-reject" data-act="reject" data-entry="${e.id}" aria-label="Reject ${esc(e.by.name)}'s tick for ${esc(c.name)}">Reject</button>
          <button type="button" class="btn btn-primary btn-sm" data-act="confirm" data-entry="${e.id}" aria-label="Confirm ${esc(e.by.name)}'s tick for ${esc(c.name)}">Confirm</button>
        </div>
      </li>`;
    }).join('') + '</ul>';
  }


  function ccAllHTML(){
    const today = todayKey();
    const ticked = classCourses().filter(c => { const e = ccToday(c); return e && e.status !== 'rejected'; }).length;
    const pendingAll = DEMO_CLASS_LOG.filter(e => e.status === 'pending').length;
    const stats = `<div class="cc-stats">
      <div class="cc-stat"><strong>${ticked}<small> / ${classCourses().length}</small></strong><span>courses ticked today</span></div>
      <div class="cc-stat"><strong>${pendingAll}</strong><span>ticks pending</span></div>
      <div class="cc-stat"><strong>${classCourses().reduce((n, c) => n + ccConfirmed(c), 0)}</strong><span>classes taken in total</span></div>
    </div>`;
    const isOwner = currentUser.role === 'owner';
    const rows = classCourses().map(c => {
      const sec = c.secondaryIds.map(i => (personById(i) || {}).name).filter(Boolean);
      const who = c.teacher ? esc(c.teacher.name) + (sec.length ? ' + ' + esc(sec.join(', ')) : '') : 'No teacher yet';
      return `<li class="cc-all-row">
        <div class="cc-all-main"><div class="cc-all-name">${esc(c.name)}</div>
          <div class="cc-all-meta">${who} · ${esc(c.batch)}</div>
          ${isOwner ? `<button type="button" class="link-btn" data-act="edit-course" data-course="${c.id}" aria-label="${c.teacher ? 'Change teachers for' : 'Assign a teacher to'} ${esc(c.name)}">${c.teacher ? 'Change teachers' : 'Assign a teacher'}</button>` : ''}
        </div>
        <div class="cc-all-num"><strong>${ccConfirmed(c)}</strong><span>of ${c.planned}</span></div>
        <div class="cc-all-status">${c.teacher ? statusPill(ccToday(c)) : '<span class="pill pill-muted">No teacher</span>'}</div>
      </li>`;
    }).join('');
    return stats + `<section class="card"><ul class="cc-all-list">${rows}</ul></section>`;
  }


  function renderClassCounter(bumpCourseId){
    persist();
    if (!currentUser) return;
    const canReview = currentUser.role === 'admin' || currentUser.role === 'owner';
    el('cc-tabs').hidden = !canReview;
    if (!canReview) ccTab = 'mine';

    const mine = ccMine();
    el('cc-mine-grid').innerHTML = mine.length ? mine.map(ccCardHTML).join('')
      : `<div class="cc-empty">${CLOCK_SVG}<h2>No classes assigned to you</h2><p>${currentUser.role === 'owner'
          ? 'Add yourself as a teacher when you add or edit a course in Courses & Pricing.'
          : 'A course shows up here once you are added as its teacher, as primary or secondary. Ask the Owner or an Admin.'}</p></div>`;
    el('cc-activity-card').hidden = mine.length === 0;
    el('cc-today').textContent = new Date().toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'long' });
    el('cc-activity-list').innerHTML = ccActivityHTML();
    if (canReview){
      el('cc-panel-queue').innerHTML = ccQueueHTML();
      el('cc-panel-all').innerHTML = ccAllHTML();
    }
    const n = canReview ? ccQueue().length : 0;
    el('cc-queue-count').textContent = n;
    el('cc-queue-count').hidden = n === 0;
    refreshBadges();

    ['mine','queue','all'].forEach(t => {
      const panel = el('cc-panel-' + t);
      if (canReview){ panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', 'cc-tab-' + t); }
      else { panel.removeAttribute('role'); panel.removeAttribute('aria-labelledby'); }
      panel.hidden = t !== ccTab;
      const btn = document.querySelector(`[data-cc-tab="${t}"]`);
      btn.setAttribute('aria-selected', String(t === ccTab));
      btn.tabIndex = t === ccTab ? 0 : -1;
    });
    if (bumpCourseId){
      const num = document.querySelector(`.cc-card[data-course="${bumpCourseId}"] .cc-total`);
      if (num) num.classList.add('bump');
    }
  }


  function initClassCounterForUser(user){
    ccTab = 'mine';
    renderClassCounter();
  }


  function initClassCounter(){
    const root = el('cc-root');
    // Only the selected tab is in the tab order, so the arrow keys must move between tabs.
    root.addEventListener('keydown', e => {
      const current = e.target.closest('[data-cc-tab]');
      if (!current) return;
      const tabs = [...root.querySelectorAll('[data-cc-tab]')];
      const i = tabs.indexOf(current);
      const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length
                 : e.key === 'ArrowLeft'  ? (i - 1 + tabs.length) % tabs.length
                 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
      if (next < 0) return;
      e.preventDefault();
      ccTab = tabs[next].dataset.ccTab;
      renderClassCounter();
      tabs[next].focus();
    });
    root.addEventListener('click', e => {
      const tab = e.target.closest('[data-cc-tab]');
      if (tab){ ccTab = tab.dataset.ccTab; renderClassCounter(); return; }
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act, course = btn.dataset.course, entry = btn.dataset.entry;

      if (act === 'tick' || act === 'undo'){
        if (act === 'tick') tickToday(course); else undoTick(course);
        renderClassCounter(course);
        const again = root.querySelector(`.cc-card[data-course="${course}"] .cc-action button`);
        if (again && !isTouch()) again.focus({ preventScroll:true });
      } else if (act === 'confirm'){
        const d = decide(entry, 'confirmed');
        if (d){ showToast(`Confirmed: ${ccCourse(d.courseId).name}`); renderClassCounter(d.courseId); }
      } else if (act === 'reject'){
        // Two taps to reject, so a stray touch can't throw a teacher's class away.
        twoTap(btn, 'Tap again to reject', () => {
          const d = decide(entry, 'rejected');
          if (d){ showToast(`Rejected: ${ccCourse(d.courseId).name}`); renderClassCounter(); }
        });
      } else if (act === 'edit-course'){
        goToEditCourse(course);
      } else if (act === 'confirm-all'){
        twoTap(btn, 'Tap again to confirm all', () => {
          const q = ccQueue();
          q.forEach(x => decide(x.id, 'confirmed'));
          showToast(`Confirmed ${q.length} ${q.length === 1 ? 'tick' : 'ticks'}`);
          renderClassCounter();
        });
      }
    });
    root.addEventListener('animationend', e => { if (e.target.classList.contains('bump')) e.target.classList.remove('bump'); });
  }

  /* ============================================================
     ANALYTICS
     Everything here is computed from the same mock data the other screens use:
     registrations made in this prototype (DEMO_REGISTRATIONS) and class ticks
     (DEMO_CLASS_LOG / DEMO_COURSES), on top of a generated 6-month history so the
     charts have something to show.
     PHASE 2 TODO: replace anEnrollments() / the weekly seed with real endpoints, e.g.
       GET /api/analytics/overview?range=7d|30d   (admin, owner)
       GET /api/analytics/today-income            (owner only)
       GET /api/analytics/me?range=...            (staff, teacher)
     All of it must be aggregated and authorised on the server. Payments should come from a
     payments table (instalments) rather than "paid at registration".
     ============================================================ */
