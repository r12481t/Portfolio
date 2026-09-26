"use strict";
/* Home screen. */

  function renderHome(){
    persist();
    if (!currentUser) return;
    const role = currentUser.role, rows = [];
    if (role === 'owner' || role === 'admin'){
      const q = ccQueue();
      if (q.length) rows.push({ go:'classcounter', tab:'queue', n:q.length, title: q.length === 1 ? 'Class tick to confirm' : 'Class ticks to confirm',
        sub:[...new Set(q.map(e => ccCourse(e.courseId).name))].join(', ') });
    }
    if (role === 'owner'){
      const pc = DEMO_COURSES.filter(c => c.status === 'pending');
      if (pc.length) rows.push({ go:'courses', n:pc.length, title: pc.length === 1 ? 'Course waiting for approval' : 'Courses waiting for approval', sub:pc.map(c => c.name).join(', ') });
      const pa = DEMO_ACCOUNTS.filter(a => a.status === 'pending');
      if (pa.length) rows.push({ go:'staffaccounts', n:pa.length, title: pa.length === 1 ? 'Account waiting for approval' : 'Accounts waiting for approval', sub:pa.map(a => a.name).join(', ') });
    }
    const mine = role === 'staff' ? [] : ccMine();
    const open = mine.filter(c => !ccToday(c));
    if (open.length) rows.push({ go:'classcounter', tab:'mine', n:open.length, title: open.length === 1 ? 'Class to tick today' : 'Classes to tick today', sub:open.map(c => c.name).join(', ') });

    const chev = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const empty = role === 'teacher' && !mine.length ? 'No classes are assigned to you yet. Ask the Owner or an Admin.'
                : role === 'teacher' ? 'Every class you teach is ticked for today.'
                : 'Nothing is waiting on you.';
    document.getElementById('home-attn-list').innerHTML = rows.length
      ? rows.map(r => `<li><button type="button" class="attn-row" data-goto="${r.go}"${r.tab ? ` data-tab="${r.tab}"` : ''}>
          <span class="attn-count" aria-hidden="true">${r.n}</span>
          <span class="attn-text"><strong><span class="visually-hidden">${r.n} </span>${r.title}</strong><small>${esc(r.sub)}</small></span>${chev}</button></li>`).join('')
      : `<li class="attn-empty">${empty}</li>`;
  }

  // Small count bubble on the Class Counter nav item (ticks waiting for this person to confirm).
