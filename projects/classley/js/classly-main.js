"use strict";

hydrate();

  function confirmResetDemo(){
    if (confirm('Reset all demo data back to the starting point? This cannot be undone.')) resetDemo();
  }

  document.getElementById('reset-demo-desktop').addEventListener('click', confirmResetDemo);
  document.getElementById('reset-demo-mobile').addEventListener('click', confirmResetDemo);
  document.getElementById('demo-reset-login').addEventListener('click', confirmResetDemo);
  document.getElementById('topbar-avatar-btn').addEventListener('click', openMoreSheet);
  document.getElementById('home-attn-list').addEventListener('click', e => {
    const row = e.target.closest('[data-goto]');
    if (!row) return;
    if (row.dataset.tab) ccTab = row.dataset.tab;
    setActiveNav(row.dataset.goto);
    if (row.dataset.tab) renderClassCounter();
  });
  document.getElementById('more-sheet-backdrop').addEventListener('click', function(e){
    if (e.target === this) closeMoreSheet();
  });

  renderDemoAccounts();
  initDrawer();
  initKeyboardWatch();
  initClassCounter();
  initAnalytics();
  initEditor();
  initCourses();
  initAccounts();
  initRegistration();

 const primaryLogo = document.getElementById('primary-logo');
  if (primaryLogo){
    document.querySelectorAll('.js-logo').forEach(img => { img.src = primaryLogo.src; });
  }
