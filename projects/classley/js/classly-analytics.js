"use strict";
/* Analytics screen. */

  const SEED_COURSE_IDS = ['c-spoken-basic','c-spoken-adv','c-grammar','c-writing','c-business','c-ielts','c-kids'];   // history uses the original catalogue

  const SEED_PACKAGE_IDS = ['p-spoken-complete','p-ielts-fast'];

  const SEED_FIRST = ['Tanvir','Nusrat','Rafi','Mim','Sakib','Farhana','Arif','Jannat','Shohan','Ayesha','Imtiaz','Sumaiya','Nayeem','Lubna','Rakib','Tasnim'];

  const SEED_LAST  = ['Ahmed','Hossain','Rahman','Islam','Akter','Khan','Sarker','Chowdhury','Begum','Uddin'];

  const SEED_STAFF = [
    { w:35, u:{ id:'staff@classly.test', name:'Sabbir Hossain' } },
    { w:30, u:{ id:'tania@classly.test', name:'Tania Rahman' } },
    { w:25, u:{ id:'mahin@classly.test', name:'Mahin Ahmed' } },
    { w:6,  u:{ id:'admin@classly.test', name:'Admin User' } },
    { w:4,  u:{ id:'owner@classly.test', name:'Tanvir Chowdhury' } }
  ];
  // Classes taken per week by each teacher, oldest first (8 weeks). Live confirmed ticks are added to the last one.

  const TEACHER_WEEKLY_SEED = {
    'teacher@classly.test':[5,6,5,7,6,7,6,4],
    'imran@classly.test':  [2,3,3,2,3,3,2,1],
    'nasrin@classly.test': [3,4,4,3,5,4,4,2],
    'admin@classly.test':  [3,3,4,3,3,4,3,2],
    'owner@classly.test':  [1,2,1,2,2,1,2,1]
  };


  let anRange = 7;

  let anSeed = null;

  const anCharts = {};        // chart id -> series (for the tap-a-bar readout)

  const anSel = {};           // chart id -> selected bar index


  function seededRandom(seed){
    let s = seed >>> 0;
    return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  }

  const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

  const daysAgoStart = n => { const x = startOfDay(new Date()); x.setDate(x.getDate() - n); return x; };

  const sumBy = (list, key) => list.reduce((s, e) => s + e[key], 0);

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;


  function moneyShort(n){
    if (n >= 100000) return '৳' + (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (n >= 1000)   return '৳' + (Math.round(n / 100) / 10) + 'k';
    return '৳' + n;
  }


  function buildSeedEnrollments(){
    const rnd = seededRandom(20260919), out = [], now = new Date();
    const pickStaff = () => { let r = rnd() * 100; for (const s of SEED_STAFF){ if ((r -= s.w) < 0) return s.u; } return SEED_STAFF[0].u; };
    for (let d = 179; d >= 0; d--){
      let n = Math.floor(rnd() * 3.6);                       // 0 to 3 registrations a day
      if (d === 0) n = Math.max(n, 2);                       // so "today" is never empty
      for (let i = 0; i < n; i++){
        const packageIds = [], courseIds = [];
        if (rnd() < 0.28) packageIds.push(SEED_PACKAGE_IDS[Math.floor(rnd() * SEED_PACKAGE_IDS.length)]);
        else {
          const pool = SEED_COURSE_IDS.slice(), k = 1 + Math.floor(rnd() * 2);
          for (let j = 0; j < k; j++) courseIds.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
        }
        const total = packageIds.reduce((s, id) => s + DEMO_PACKAGES.find(p => p.id === id).price, 0)
                    + courseIds.reduce((s, id) => s + courseById(id).price, 0);
        const partial = rnd() < (d > 60 ? 0.08 : 0.32);      // older registrations are mostly settled
        const paid = partial ? Math.round(total * (0.3 + rnd() * 0.5) / 100) * 100 : total;
        const date = new Date(now); date.setDate(date.getDate() - d);
        date.setHours(Math.min(9 + Math.floor(rnd() * 9), d === 0 ? now.getHours() : 23), Math.floor(rnd() * 60), 0, 0);
        const student = SEED_FIRST[Math.floor(rnd() * SEED_FIRST.length)] + ' ' + SEED_LAST[Math.floor(rnd() * SEED_LAST.length)];
        out.push({ date, by:pickStaff(), student, packageIds, courseIds, total, paid });
      }
    }
    return out;
  }


  function anEnrollments(){
    if (!anSeed) anSeed = buildSeedEnrollments();
    const live = DEMO_REGISTRATIONS.map(r => ({
      date:new Date(r.createdAt), by:r.registeredBy, student:r.student.name,
      packageIds:r.packageIds, courseIds:r.courseIds, total:r.totals.total, paid:r.totals.paid
    }));
    return anSeed.concat(live);
  }

  function enrolledCourseIds(e){
    const ids = new Set(e.courseIds);
    e.packageIds.forEach(pid => DEMO_PACKAGES.find(p => p.id === pid).includes.forEach(c => ids.add(c)));
    return [...ids];
  }

  function enrollmentSummary(e){
    return e.packageIds.map(pid => DEMO_PACKAGES.find(p => p.id === pid).name)
      .concat(e.courseIds.map(cid => courseById(cid).name)).join(', ');
  }
  // Rolling window of `days` days ending `offset` days before today (offset 0 = the last `days` days incl. today).

  function windowOf(list, days, offset){
    const from = daysAgoStart(days - 1 + offset).getTime(), to = daysAgoStart(offset - 1).getTime();
    return list.filter(e => e.date.getTime() >= from && e.date.getTime() < to);
  }

  function dailySeries(list, days, valueOf, readoutOf){
    const out = [];
    for (let i = days - 1; i >= 0; i--){
      const start = daysAgoStart(i), end = daysAgoStart(i - 1);
      const items = list.filter(e => e.date >= start && e.date < end);
      const value = valueOf(items);
      out.push({
        value,
        label: days <= 7 ? start.toLocaleDateString(undefined, { weekday:'short' })
                         : start.toLocaleDateString(undefined, { day:'numeric', month:'short' }),
        full: start.toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'long' }) + (i === 0 ? ' (today)' : ''),
        readout: readoutOf(value, items)
      });
    }
    return out;
  }


  function deltaHTML(cur, prev, days){
    if (!prev) return '';
    const pct = Math.round((cur - prev) / prev * 100);
    return `<span class="delta ${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}">${pct > 0 ? '+' : ''}${pct}% vs previous ${days} days</span>`;
  }

  const statCardHTML = (label, value, sub) =>
    `<div class="an-stat"><span class="lbl">${label}</span><span class="val">${value}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;


  function barChartHTML(id, series){
    anCharts[id] = series;
    const max = Math.max(1, ...series.map(s => s.value));
    const sel = anSel[id] !== undefined && anSel[id] < series.length ? anSel[id] : series.length - 1;
    const cols = series.map((s, i) => `
      <button type="button" class="bar-col${i === sel ? ' is-sel' : ''}" data-chart="${id}" data-i="${i}" aria-label="${esc(s.full)}: ${esc(s.readout)}">
        <span class="bar" style="height:${s.value ? Math.max(3, s.value / max * 100) : 0}%"></span>
      </button>`).join('');
    const axis = series.map((s, i) =>
      `<span>${(series.length <= 10 || (series.length - 1 - i) % 5 === 0) ? `<i>${esc(s.label)}</i>` : ''}</span>`).join('');
    return `<div class="bars">
      <div class="bar-plot"><span class="bar-max">${id === 'rev' ? moneyShort(max) : max}</span>${cols}</div>
      <div class="bar-axis" aria-hidden="true">${axis}</div>
      <div class="bar-readout" id="readout-${id}" aria-live="polite"><strong>${esc(series[sel].full)}</strong> · ${esc(series[sel].readout)}</div>
    </div>`;
  }


  function hbarListHTML(rows, emptyText){
    if (!rows.length) return `<p class="an-empty">${emptyText}</p>`;
    const max = Math.max(1, ...rows.map(r => r.value));
    return '<ul class="hbar-list">' + rows.map(r => `
      <li>
        <div class="hbar-top"><span class="hbar-name">${esc(r.name)}</span><span class="hbar-val">${r.valueText}</span></div>
        <div class="hbar-track"><span class="hbar-fill" style="width:${Math.max(r.value ? 3 : 0, r.value / max * 100)}%"></span></div>
        ${r.sub ? `<div class="hbar-sub">${r.sub}</div>` : ''}
      </li>`).join('') + '</ul>';
  }


  const rangeControlHTML = () => `
    <div class="segmented an-range" role="group" aria-label="Time range">
      ${[7, 30].map(n => `<button type="button" class="seg-btn" data-an-range="${n}" aria-pressed="${anRange === n}">Last ${n} days</button>`).join('')}
    </div>`;

  /* ---- Owner / Admin ---- */

  function adminAnalyticsHTML(){
    const list = anEnrollments(), R = anRange;
    const cur = windowOf(list, R, 0), prev = windowOf(list, R, R);
    const rev = sumBy(cur, 'paid'), revPrev = sumBy(prev, 'paid');
    const billed = sumBy(cur, 'total'), dueInRange = billed - rev;
    const dueAll = list.reduce((s, e) => s + (e.total - e.paid), 0);
    const owing = list.filter(e => e.total > e.paid).length;
    const active = list.filter(e => e.date >= daysAgoStart(89)).length;
    const today = windowOf(list, 1, 0);

    let html = '';
    if (currentUser.role === 'owner'){
      html += `<div class="an-hero"><div><div class="lbl">Today's income</div><div class="big">${money(sumBy(today, 'paid'))}</div></div>
        <div class="sub">${plural(today.length, 'registration', 'registrations')} today · ${money(sumBy(today, 'total') - sumBy(today, 'paid'))} still due from them</div></div>`;
    }
    html += `<div class="an-toolbar"><div class="an-title"><h2 class="an-h">Overview</h2>${updatedHTML()}</div>${rangeControlHTML()}</div>`;
    html += `<div class="an-stats">
      ${statCardHTML('Revenue collected', money(rev), deltaHTML(rev, revPrev, R))}
      ${statCardHTML('Outstanding due', money(dueAll), `${plural(owing, 'student owes', 'students owe')} a balance`)}
      ${statCardHTML('Total students', list.length.toLocaleString('en-IN'), `${active.toLocaleString('en-IN')} active (last 90 days)`)}
      ${statCardHTML('New enrollments', cur.length, deltaHTML(cur.length, prev.length, R))}
    </div>`;

    // Revenue trend
    const revSeries = dailySeries(list, R, items => sumBy(items, 'paid'),
      (v, items) => `${money(v)} collected · ${plural(items.length, 'registration', 'registrations')}`);
    const revCard = `<section class="card an-card an-span"><div class="card-head"><h2>Revenue collected each day</h2></div>
      <p class="card-sub">Tap a bar to see that day.</p>${barChartHTML('rev', revSeries)}</section>`;

    // Collected vs due
    const paidPct = billed ? Math.round(rev / billed * 100) : 0;
    const owed = list.filter(e => e.total > e.paid).sort((a, b) => (b.total - b.paid) - (a.total - a.paid)).slice(0, 4);
    const balancesHTML = owed.length ? '<ul class="recent-list">' + owed.map(e => `<li class="recent-row"><div class="recent-main"><div class="recent-name">${esc(e.student)}</div>
      <div class="recent-meta">${esc(e.date.toLocaleDateString(undefined, { day:'numeric', month:'short' }))} · by ${esc(e.by.name)}</div></div>
      <div class="recent-money"><div class="is-due">${money(e.total - e.paid)} due</div><div>of ${money(e.total)}</div></div></li>`).join('') + '</ul>'
      : '<p class="an-empty">No outstanding balances.</p>';
    const cvd = `<section class="card an-card"><div class="card-head"><h2>Collected vs due</h2></div>
      <p class="card-sub">Fees billed in the last ${R} days.</p>
      ${billed ? `<div class="stack" role="img" aria-label="${paidPct}% collected, ${100 - paidPct}% due"><span class="seg-paid" style="width:${paidPct}%"></span><span class="seg-due" style="width:${100 - paidPct}%"></span></div>
      <div class="legend"><span><i class="sw-paid"></i>Collected <strong>${money(rev)}</strong> (${paidPct}%)</span><span><i class="sw-due"></i>Due <strong>${money(dueInRange)}</strong> (${100 - paidPct}%)</span></div>`
      : '<p class="an-empty">No registrations in this period.</p>'}
      <p class="group-label an-sublabel">Largest balances due (all time)</p>${balancesHTML}</section>`;

    // Per-course enrollment
    const counts = DEMO_COURSES.filter(c => c.status === 'active').map(c => ({ name:c.name, value:cur.filter(e => enrolledCourseIds(e).includes(c.id)).length }))
      .sort((a, b) => b.value - a.value).map(r => ({ ...r, valueText:plural(r.value, 'student', 'students') }));
    const perCourse = `<section class="card an-card"><div class="card-head"><h2>Enrollments by course</h2></div>
      <p class="card-sub">Packages count toward each course they include.</p>${hbarListHTML(counts, 'No enrollments in this period.')}</section>`;

    // Teacher completion (from Class Counter data)
    const byTeacher = {};
    classCourses().filter(c => c.teacher).forEach(c => {
      const t = byTeacher[c.teacher.id] = byTeacher[c.teacher.id] || { name:c.teacher.name, done:0, planned:0, pending:0, courses:0 };
      t.done += ccConfirmed(c); t.planned += c.planned; t.pending += ccPending(c); t.courses++;
    });
    const teachers = Object.values(byTeacher).map(t => ({
      name:t.name, value:Math.round(t.done / t.planned * 100), valueText:Math.round(t.done / t.planned * 100) + '%',
      sub:`${t.done} of ${t.planned} classes · ${plural(t.courses, 'course', 'courses')}${t.pending ? ` · <b class="cc-pend">${t.pending} pending</b>` : ''}`
    })).sort((a, b) => b.value - a.value);
    const completion = `<section class="card an-card"><div class="card-head"><h2>Teacher class completion</h2></div>
      <p class="card-sub">Confirmed classes against each teacher's planned classes.</p>${hbarListHTML(teachers, 'No classes yet.')}</section>`;

    // Registrations by staff (referrals)
    const byStaff = {};
    cur.forEach(e => { const s = byStaff[e.by.id] = byStaff[e.by.id] || { name:e.by.name, n:0, rev:0 }; s.n++; s.rev += e.paid; });
    const staff = Object.values(byStaff).sort((a, b) => b.n - a.n)
      .map(s => ({ name:s.name, value:s.n, valueText:plural(s.n, 'registration', 'registrations'), sub:`${money(s.rev)} collected` }));
    const referrals = `<section class="card an-card"><div class="card-head"><h2>Registrations by staff</h2></div>
      <p class="card-sub">Each registration is credited to the account that made it.</p>${hbarListHTML(staff, 'No registrations in this period.')}</section>`;

    return html + `<div class="an-grid">${revCard}${cvd}${perCourse}${completion}${referrals}</div>`;
  }

  /* ---- Staff: own registrations and referrals ---- */

  function staffAnalyticsHTML(){
    const mine = anEnrollments().filter(e => e.by.id === currentUser.id), R = anRange;
    const cur = windowOf(mine, R, 0), prev = windowOf(mine, R, R);
    const dueMine = mine.reduce((s, e) => s + (e.total - e.paid), 0);
    const series = dailySeries(mine, R, items => items.length,
      (v, items) => `${plural(v, 'registration', 'registrations')}${v ? ' · ' + money(sumBy(items, 'paid')) + ' collected' : ''}`);
    const recent = mine.slice().sort((a, b) => b.date - a.date).slice(0, 6);
    const recentHTML = recent.length ? '<ul class="recent-list">' + recent.map(e => {
      const due = e.total - e.paid;
      return `<li class="recent-row"><div class="recent-main"><div class="recent-name">${esc(e.student)}</div>
        <div class="recent-meta">${esc(e.date.toLocaleDateString(undefined, { day:'numeric', month:'short' }))} · ${esc(enrollmentSummary(e))}</div></div>
        <div class="recent-money"><div>${money(e.paid)} paid</div><div class="${due ? 'is-due' : 'is-clear'}">${due ? money(due) + ' due' : 'Cleared'}</div></div></li>`;
    }).join('') + '</ul>' : '<p class="an-empty">Your registrations will show up here.</p>';

    return `<div class="an-toolbar"><div class="an-title"><h2 class="an-h">Your numbers</h2>${updatedHTML()}</div>${rangeControlHTML()}</div>
      <div class="an-stats">
        ${statCardHTML('Registrations', cur.length, deltaHTML(cur.length, prev.length, R))}
        ${statCardHTML('Fees collected', money(sumBy(cur, 'paid')), `from your registrations, last ${R} days`)}
        ${statCardHTML('Still due', money(dueMine), 'on your registrations, all time')}
        ${statCardHTML('All-time referrals', mine.length, 'students you have registered')}
      </div>
      <div class="an-grid">
        <section class="card an-card an-span"><div class="card-head"><h2>Your registrations each day</h2></div><p class="card-sub">Tap a bar to see that day.</p>${barChartHTML('mine', series)}</section>
        <section class="card an-card an-span"><div class="card-head"><h2>Your recent registrations</h2></div>${recentHTML}</section>
      </div>`;
  }

  /* ---- Teacher: own classes ---- */

  function teacherAnalyticsHTML(){
    const mineCourses = ccMine(), weekStart = daysAgoStart(6);
    const liveConfirmed = DEMO_CLASS_LOG.filter(e => e.by.id === currentUser.id && e.status === 'confirmed' && new Date(e.at) >= weekStart).length;
    const seed = (TEACHER_WEEKLY_SEED[currentUser.id] || [0, 0, 0, 0, 0, 0, 0, 0]).slice();
    seed[7] += liveConfirmed;
    const series = seed.map((v, i) => ({
      value:v, label:i === 7 ? 'Now' : `-${7 - i}w`,
      full:i === 7 ? 'This week (last 7 days)' : `${plural(7 - i, 'week', 'weeks')} ago`,
      readout:plural(v, 'class', 'classes')
    }));
    const taken = mineCourses.reduce((s, c) => s + ccConfirmed(c), 0);
    const pending = DEMO_CLASS_LOG.filter(e => e.by.id === currentUser.id && e.status === 'pending').length;
    const rejected = DEMO_CLASS_LOG.filter(e => e.by.id === currentUser.id && e.status === 'rejected').length;
    const rows = mineCourses.map(c => ({
      name:c.name, value:Math.round(ccConfirmed(c) / c.planned * 100), valueText:Math.round(ccConfirmed(c) / c.planned * 100) + '%',
      sub:`${ccConfirmed(c)} of ${c.planned} classes · ${esc(c.batch)}${ccPending(c) ? ` · <b class="cc-pend">${ccPending(c)} pending</b>` : ''}`
    }));
    return `<div class="an-stats">
        ${statCardHTML('Classes taken', taken, 'confirmed, across your courses')}
        ${statCardHTML('This week', seed[7], 'confirmed in the last 7 days')}
        ${statCardHTML('Waiting for confirmation', pending, 'not counted yet')}
        ${statCardHTML('Not accepted', rejected, rejected ? 'tick again if the class happened' : 'nothing rejected')}
      </div>
      <div class="an-grid">
        <section class="card an-card an-span"><div class="card-head"><h2>Classes you took each week</h2></div><p class="card-sub">The last 8 weeks. Tap a bar to see that week.</p>${barChartHTML('week', series)}</section>
        <section class="card an-card an-span"><div class="card-head"><h2>Course progress</h2></div>${hbarListHTML(rows, 'No courses assigned to you yet.')}</section>
      </div>`;
  }


  const updatedHTML = () => `<span class="an-updated">Updated ${new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}</span>`;

  const analyticsSkeletonHTML = () => `<div role="status"><span class="visually-hidden">Loading analytics</span></div>
    <div class="skel" style="height:132px" aria-hidden="true"></div>
    <div class="an-grid" aria-hidden="true" style="margin-top:22px"><div class="skel" style="height:96px"></div><div class="skel" style="height:96px"></div><div class="skel" style="height:96px"></div><div class="skel" style="height:96px"></div></div>
    <div class="skel" style="height:220px;margin-top:14px" aria-hidden="true"></div>`;

  const analyticsErrorHTML = () => `<section class="card an-error" role="alert">
      <h2 class="an-h">Analytics didn't load</h2>
      <p>Check your connection, then try again.</p>
      <button type="button" class="btn btn-primary btn-sm" data-an-retry>Try again</button>
    </section>`;

  let anLoadTimer = null;
  /* PHASE 2 TODO: GET /api/analytics/... replaces the timeout. While the request runs the skeleton stays up;
     a failed request lands in analyticsErrorHTML(). withLoad is true when a person opens the screen, false for a range change. */

  function renderAnalytics(withLoad){
    persist();
    if (!currentUser || !el('an-root')) return;
    clearTimeout(anLoadTimer);
    const root = el('an-root'), role = currentUser.role;
    const paint = () => {
      try {
        root.innerHTML = (role === 'owner' || role === 'admin') ? adminAnalyticsHTML()
          : role === 'teacher' ? teacherAnalyticsHTML() : staffAnalyticsHTML();
      } catch (err){ root.innerHTML = analyticsErrorHTML(); }
      root.removeAttribute('aria-busy');
    };
    if (withLoad === true){
      root.setAttribute('aria-busy', 'true');
      root.innerHTML = analyticsSkeletonHTML();
      anLoadTimer = setTimeout(paint, 350);
    } else paint();
  }


  function initAnalyticsForUser(){ anRange = 7; Object.keys(anSel).forEach(k => delete anSel[k]); }


  function initAnalytics(){
    el('an-root').addEventListener('click', e => {
      if (e.target.closest('[data-an-retry]')){ renderAnalytics(true); return; }
      const r = e.target.closest('[data-an-range]');
      if (r){
        anRange = Number(r.dataset.anRange);
        Object.keys(anSel).forEach(k => delete anSel[k]);
        renderAnalytics();
        const again = el('an-root').querySelector(`[data-an-range="${anRange}"]`);
        if (again && !isTouch()) again.focus({ preventScroll:true });
        return;
      }
      const bar = e.target.closest('.bar-col');
      if (bar){
        const id = bar.dataset.chart, i = Number(bar.dataset.i), s = anCharts[id][i];
        anSel[id] = i;
        bar.parentElement.querySelectorAll('.bar-col').forEach(b => b.classList.toggle('is-sel', b === bar));
        el('readout-' + id).innerHTML = `<strong>${esc(s.full)}</strong> · ${esc(s.readout)}`;
      }
    });
  }

  /* ============================================================
     COURSES & PRICING  and  STAFF ACCOUNTS
     Approval rules (from the client):
       - The Owner adds courses and accounts directly.
       - An Admin can add courses and staff accounts too, but each new one waits for the Owner's approval.
       - When creating a course, the Owner or Admin picks a primary teacher and any secondary teachers.
         (For an Admin's course they take effect once the Owner approves it.)
       - On an EXISTING course only the Owner can change teachers. Admin can edit details and prices.
       - Removing a course archives it (hidden from registration and Class Counter, history kept).
     PHASE 2 TODO: every rule here must be enforced by the server, not the browser.
     ============================================================ */
