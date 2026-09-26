"use strict";
/* Sign-in screen. */

  function renderDemoAccounts(){
    const list = document.getElementById('demo-list');
    list.innerHTML = DEMO_USERS.filter(u => u.demoPanel !== false).map(u => `
      <div class="demo-row">
        <div>
          <div class="demo-cred">${u.id} / ${u.password}</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="demo-role">${u.role}</span>
          <button type="button" class="demo-fill" data-id="${u.id}" data-password="${u.password}" aria-label="Fill in the ${u.role} account">Fill</button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.demo-fill').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.getElementById('input-id').value = btn.dataset.id;
        document.getElementById('input-password').value = btn.dataset.password;
      });
    });
  }


  function setFieldError(fieldId, hasError){
    const field = document.getElementById(fieldId);
    field.classList.toggle('has-error', hasError);
    const input = field.querySelector('input');
    if (input){ if (hasError) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
  }


  function handleLogin(e){
    e.preventDefault();
    const idInput = document.getElementById('input-id');
    const pwInput = document.getElementById('input-password');
    const id = idInput.value.trim().toLowerCase();
    const pw = pwInput.value;
    const submitBtn = document.getElementById('login-submit');
    const loginError = document.getElementById('login-error');

    setFieldError('field-id', false);
    setFieldError('field-password', false);
    loginError.hidden = true;

    if (!id || !pw){
      setFieldError('field-id', !id);
      setFieldError('field-password', !pw);
      (!id ? idInput : pwInput).focus();
      return;
    }

    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;

    // Simulated network round-trip. Phase 2: real POST /api/login here.
    setTimeout(()=>{
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;

      // The person can type their system ID or their email. PHASE 2 TODO: the server does this lookup.
      const acct = DEMO_ACCOUNTS.find(a => [a.id, a.staffId, a.email].some(v => v && v.toLowerCase() === id));
      const match = acct && DEMO_USERS.find(u => u.id === acct.id);
      // One message for both cases, so the form never confirms that an ID exists.
      // PHASE 2 TODO: the server returns the same generic error for an unknown ID and a wrong password.
      if (!match || match.password !== pw){
        loginError.hidden = false;
        pwInput.focus();
        pwInput.select();
        return;
      }
      logIn(match);
    }, 380);
  }


  function logIn(user){
    currentUser = user;
    const loginView = document.getElementById('login-view');
    const shell = document.getElementById('app-shell');
    loginView.classList.add('is-leaving');
    setTimeout(()=>{
      loginView.classList.add('hidden');
      loginView.classList.remove('is-leaving');
      shell.classList.add('active');
      buildShellForUser(user);
      initRegistrationForUser(user);
      initClassCounterForUser(user);
      initAnalyticsForUser(user);
      initAdminScreensForUser();
      refreshBadges();
      setActiveNav('home');
    }, 200);
  }


  function logOut(){
    currentUser = null;
    document.getElementById('login-form').reset();
    setFieldError('field-id', false);
    setFieldError('field-password', false);
    document.getElementById('login-error').hidden = true;
    document.getElementById('app-shell').classList.remove('active');
    document.getElementById('login-view').classList.remove('hidden');
    closeMoreSheet();
    resetRegistrationForm(false);
  }

