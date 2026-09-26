"use strict";
/* Shared app chrome: sidebar/bottom nav, the mobile "More" sheet, badges, toasts,
   and small helpers used by more than one screen. */

  function navForRole(role){
    return NAV_ITEMS.filter(item => item.roles.includes(role))
      .map(item => ({...item, label: (item.labelFor && item.labelFor[role]) || item.label}));
  }


  function initials(name){
    return name.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase();
  }


  function buildShellForUser(user){
    const items = navForRole(user.role);

    // Sidebar (desktop)
    const sidebarNav = document.getElementById('sidebar-nav');
    sidebarNav.innerHTML = items.map(item => navItemHTML(item)).join('');

    // Bottom bar (mobile): first 4 + "More" if there's overflow
    const bottomNav = document.getElementById('bottom-nav');
    const visible = items.slice(0,4);
    const overflow = items.slice(4);
    let bottomHTML = visible.map(item => bottomItemHTML(item)).join('');
    if (overflow.length){
      bottomHTML += `<button class="bottom-item" data-more="1"><svg viewBox="0 0 24 24" fill="none">${ICONS.more}</svg><span>More</span></button>`;
    } else {
      // Roles with four or fewer screens have no "More", but everyone needs a way to log out.
      bottomHTML += `<button class="bottom-item" data-more="1"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 20.5c.6-3.6 3.7-5.5 7.5-5.5s6.9 1.9 7.5 5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span>Account</span></button>`;
    }
    bottomNav.innerHTML = bottomHTML;

    const moreSheetNav = document.getElementById('more-sheet-nav');
    moreSheetNav.innerHTML = overflow.map(item => navItemHTML(item)).join('');

    // User identity
    document.getElementById('sidebar-avatar').textContent = initials(user.name);
    document.getElementById('sidebar-username').textContent = user.name;
    document.getElementById('sidebar-role').textContent = user.role;
    document.getElementById('topbar-avatar').textContent = initials(user.name);
    document.getElementById('sheet-avatar').textContent = initials(user.name);
    document.getElementById('sheet-name').textContent = user.name;
    document.getElementById('sheet-role').textContent = user.role;

    document.getElementById('analytics-title').textContent =
      (user.role === 'teacher' || user.role === 'staff') ? 'My Analytics' : 'Analytics';

    // Home
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    document.getElementById('home-greeting').textContent = `${timeGreeting}, ${user.name.split(' ')[0]}`;
    document.getElementById('home-date').textContent = new Date().toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    document.getElementById('home-role-pill').textContent = user.role;

    const quickGrid = document.getElementById('home-quick-grid');
    quickGrid.innerHTML = QUICK_ACTIONS[user.role].map(id=>{
      const item = NAV_ITEMS.find(n=>n.id===id);
      const label = (item.labelFor && item.labelFor[user.role]) || item.label;
      return `
        <button class="quick-card" data-goto="${item.id}">
          <div class="quick-icon">${icon(item.id)}</div>
          <h2>${label}</h2>
        </button>`;
    }).join('');
    quickGrid.querySelectorAll('[data-goto]').forEach(btn=>{
      btn.addEventListener('click', ()=> setActiveNav(btn.dataset.goto));
    });

    // Wire up nav clicks (sidebar + bottom + more sheet)
    document.querySelectorAll('#sidebar-nav .nav-item, #more-sheet-nav .nav-item, #bottom-nav .bottom-item[data-nav]').forEach(el=>{
      el.addEventListener('click', ()=>{
        if (el.dataset.nav) setActiveNav(el.dataset.nav);
      });
    });
    document.querySelectorAll('#bottom-nav [data-more]').forEach(el=>{
      el.addEventListener('click', openMoreSheet);
    });
  }

  /* Home answers one question: is anything waiting on me? Everything here is counted from the same
     data the other screens use, so it is always current when the person lands on Home. */

  function badgeHTML(id){ return ['classcounter','courses','staffaccounts'].includes(id) ? `<span class="nav-badge" data-badge="${id}" hidden></span>` : ''; }

  function navItemHTML(item){
    return `<li><button class="nav-item" data-nav="${item.id}">${icon(item.id)}<span>${item.label}</span>${badgeHTML(item.id)}</button></li>`;
  }

  function bottomItemHTML(item){
    return `<button class="bottom-item" data-nav="${item.id}">${icon(item.id)}<span>${(item.shortFor && currentUser && item.shortFor[currentUser.role]) || item.short || item.label}</span>${badgeHTML(item.id)}</button>`;
  }


  function setActiveNav(id){
    const item = NAV_ITEMS.find(n=>n.id===id);
    if (!item) return;
    currentSection = item.section;
    showSection(item.section);
    document.getElementById('topbar-title').textContent =
      (item.labelFor && currentUser && item.labelFor[currentUser.role]) || item.label;

    document.querySelectorAll('.nav-item, .bottom-item').forEach(el=>{
      const on = el.dataset.nav === id;
      el.classList.toggle('active', on);
      if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
    closeMoreSheet(false);
    window.scrollTo({top:0, behavior:'instant'});
    document.getElementById('main-content').focus({ preventScroll:true });   // new screen, new starting point for keyboard and screen readers
  }


  function showSection(section){
    document.querySelectorAll('.section').forEach(s=>{
      s.classList.toggle('active', s.dataset.section === section);
    });
    if (section === 'courses') renderCourses();
    if (section === 'staffaccounts') renderAccounts();
    if (section === 'analytics') renderAnalytics(true);      // always fresh: it reads live registrations and class ticks
    if (section === 'home') renderHome();
  }


  let moreSheetOpener = null;

  function openMoreSheet(){
    moreSheetOpener = document.activeElement;
    document.getElementById('more-sheet-backdrop').classList.add('active');
    const first = document.querySelector('#more-sheet-nav .nav-item, #logout-btn-mobile');
    if (first) first.focus({ preventScroll:true });
  }

  function closeMoreSheet(restoreFocus = true){
    const backdrop = document.getElementById('more-sheet-backdrop');
    const wasOpen = backdrop.classList.contains('active');
    backdrop.classList.remove('active');
    if (wasOpen && restoreFocus && moreSheetOpener && moreSheetOpener.isConnected && moreSheetOpener.offsetParent !== null) moreSheetOpener.focus({ preventScroll:true });
    moreSheetOpener = null;
  }
  document.addEventListener('keydown', e => {
    if (!document.getElementById('more-sheet-backdrop').classList.contains('active')) return;
    if (e.key === 'Escape'){ e.preventDefault(); closeMoreSheet(); return; }
    if (e.key !== 'Tab') return;
    const items = [...document.querySelectorAll('#more-sheet button')].filter(b => b.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === document.getElementById('more-sheet'))){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });

  /* ============================================================
     COURSE REGISTRATION
     PHASE 2 TODO: DEMO_COURSES / DEMO_PACKAGES stand in for
       GET /api/courses and GET /api/packages (managed on the
       Courses & Pricing screen). BD_GEO stands in
       for a full division > district > upazila lookup (GET /api/geo).
       DEMO_REGISTRATIONS stands in for the registrations table;
       submitRegistration() for POST /api/registrations. Registration
       IDs, "registered by", and fee totals must all be computed and
       verified server side.
     ============================================================ */
  /* The "accounts" table behind Staff Accounts (login credentials live in DEMO_USERS).
     status: 'active' | 'pending' (an Admin asked, the Owner has not approved yet) | 'declined'.
     PHASE 2 TODO: GET/POST/PATCH/DELETE /api/users. The server creates the login, sends credentials,
     and enforces: Admin-created accounts stay pending until the Owner approves. */

  let toastTimer = null;

  /* ---------- Address block: Division > District > Upazila are drawer pickers, Village is typed ---------- */

  function showToast(msg){
    const t = el('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }


  const isOwnerUser = () => !!currentUser && currentUser.role === 'owner';

  function twoTap(btn, armedText, run){
    if (btn.dataset.armed !== '1'){
      btn.dataset.armed = '1'; btn.dataset.orig = btn.textContent; btn.dataset.origLabel = btn.getAttribute('aria-label') || '';
      btn.classList.add('is-armed'); btn.textContent = armedText;
      if (btn.dataset.origLabel) btn.setAttribute('aria-label', armedText + ': ' + btn.dataset.origLabel);
      setTimeout(() => {
        if (btn.isConnected && btn.dataset.armed === '1'){
          btn.dataset.armed = ''; btn.classList.remove('is-armed'); btn.textContent = btn.dataset.orig;
          if (btn.dataset.origLabel) btn.setAttribute('aria-label', btn.dataset.origLabel);
        }
      }, 4000);
      return;
    }
    run();
  }

  // Count bubbles on the nav: ticks waiting for review, and (Owner only) courses / accounts waiting for approval.

  function refreshBadges(){
    if (!currentUser) return;
    const owner = currentUser.role === 'owner', review = owner || currentUser.role === 'admin';
    const counts = {
      classcounter: review ? ccQueue().length : 0,
      courses: owner ? DEMO_COURSES.filter(c => c.status === 'pending').length : 0,
      staffaccounts: owner ? DEMO_ACCOUNTS.filter(a => a.status === 'pending').length : 0
    };
    Object.keys(counts).forEach(id => document.querySelectorAll(`[data-badge="${id}"]`).forEach(b => { b.textContent = counts[id]; b.hidden = counts[id] === 0; }));
  }

