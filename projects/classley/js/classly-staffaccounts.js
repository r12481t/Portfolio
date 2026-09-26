"use strict";
/* Staff Accounts screen. */

  let saNotice = null;     // banner on Staff Accounts

  let saFilter = 'all';

  // Two taps for anything destructive, so a stray touch can't do it.

  const canManageAccount = a => currentUser.role === 'owner' || (currentUser.role === 'admin' && (a.role === 'staff' || a.role === 'teacher'));

  const canDeleteAccount = a => canManageAccount(a) && a.id !== currentUser.id;

  const rolesICanCreate = () => isOwnerUser() ? ['staff','teacher','admin'] : ['staff','teacher'];

  const genPassword = () => { const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };

  const maskEmail = e => { const [u, d] = String(e).split('@'); return (u ? u[0] : '') + '***@' + (d || ''); };

  const newOtp = () => ({ code:String(100000 + Math.floor(Math.random() * 900000)), expires:Date.now() + 5 * 60000, tries:0 });

  const credentialsHTML = (a, pw) => `<strong>${esc(a.name)}'s account is ready.</strong> ID <code>${esc(a.staffId)}</code> (they can also sign in with <code>${esc(a.email)}</code>) · temporary password <code>${esc(pw)}</code>. Share these with them privately.
    <span class="cp-note">Prototype only: the real system sends credentials itself and never shows a password.</span>`;


  function activateAccount(a){
    DEMO_USERS.push({ id:a.id, password:a.tempPassword, role:a.role, name:a.name, demoPanel:false });
    a.status = 'active';
    const pw = a.tempPassword; delete a.tempPassword;
    return pw;
  }

  function unassignFromCourses(personId){
    let n = 0;
    DEMO_COURSES.forEach(c => {
      if (c.teacherId === personId){ c.teacherId = ''; n++; }
      if (c.secondaryIds.includes(personId)){ c.secondaryIds = c.secondaryIds.filter(x => x !== personId); n++; }
    });
    return n;
  }


  function accountRowHTML(a){
    const teaches = classCourses().filter(c => isTeacherOf(c, a.id)).length;
    const you = a.id === currentUser.id;
    return `<li class="card sa-row" data-account="${esc(a.id)}">
      <div class="user-avatar">${esc(initials(a.name))}</div>
      <div class="sa-main"><div class="sa-name">${esc(a.name)}${you ? '<span class="mini-tag">You</span>' : ''}</div>
        <div class="sa-sub">${emailHTML(a.email)}</div><div class="sa-sub">ID ${esc(a.staffId)} · ${esc(a.mobile)}${teaches ? ` · Teaches ${plural(teaches, 'course', 'courses')}` : ''}</div></div>
      <span class="pill pill-muted">${ROLE_LABEL[a.role]}</span>
      <div class="sa-actions">${canManageAccount(a)
        ? `<button type="button" class="btn btn-ghost btn-sm" data-act="edit-account" data-id="${esc(a.id)}" aria-label="Edit ${esc(a.name)}">Edit</button>` +
          (canDeleteAccount(a) ? `<button type="button" class="btn btn-ghost btn-sm is-reject" data-act="delete-account" data-id="${esc(a.id)}" aria-label="Delete ${esc(a.name)}">Delete</button>` : '')
        : '<span class="sa-locked">Only the Owner can change this account.</span>'}</div>
    </li>`;
  }


  function renderAccounts(){
    persist();
    if (!currentUser || !el('sa-root')) return;
    const owner = isOwnerUser();
    const pending = DEMO_ACCOUNTS.filter(a => a.status === 'pending'), declined = DEMO_ACCOUNTS.filter(a => a.status === 'declined');
    const activeAll = DEMO_ACCOUNTS.filter(a => a.status === 'active');
    const inFilter = a => saFilter === 'all' || (saFilter === 'admin' ? (a.role === 'admin' || a.role === 'owner') : a.role === saFilter);
    const filters = [['all','All'],['staff','Staff'],['teacher','Teachers'],['admin','Admins']];
    let html = noticeHTML(saNotice);
    html += `<div class="cp-buttons"><button type="button" class="btn btn-primary btn-sm" data-act="add-account">Add account</button></div>`;
    if (pending.length){
      html += `<section class="card cp-approvals" aria-labelledby="sa-h-pending"><div class="card-head"><h2 id="sa-h-pending">${owner ? 'Waiting for your approval' : 'Waiting for the Owner'}</h2><span class="count-pill">${pending.length}</span></div>
        <ul class="cp-list">${pending.map(a => `<li class="cp-approval">
          <div class="cp-approval-main"><div class="cp-approval-name">${esc(a.name)} <span class="mini-tag">${ROLE_LABEL[a.role]}</span></div>
            <div class="cp-approval-meta">ID ${esc(a.staffId)} · ${emailHTML(a.email)} ${a.emailVerified ? '<span class="mini-tag">Email verified</span>' : ''} · ${esc(a.mobile)}</div>
            <div class="cp-approval-meta">Requested by ${esc(a.requestedBy ? a.requestedBy.name : 'an Admin')} · ${esc(fmtDay(a.requestedAt))}</div></div>
          ${owner ? `<div class="cp-approval-actions">
              <button type="button" class="btn btn-primary btn-sm" data-act="approve-account" data-id="${esc(a.id)}" aria-label="Approve ${esc(a.name)}">Approve</button>
              <button type="button" class="btn btn-ghost btn-sm is-reject" data-act="decline-account" data-id="${esc(a.id)}" aria-label="Decline ${esc(a.name)}">Decline</button></div>`
            : '<span class="pill pill-warning">Waiting for approval</span>'}
        </li>`).join('')}</ul></section>`;
    }
    if (declined.length){
      html += `<section class="card cp-approvals is-declined"><div class="card-head"><h2>Declined</h2></div><ul class="cp-list">${declined.map(a => `<li class="cp-approval">
        <div class="cp-approval-main"><div class="cp-approval-name">${esc(a.name)}</div><div class="cp-approval-meta">Declined by the Owner. Requested by ${esc(a.requestedBy ? a.requestedBy.name : 'an Admin')}.</div></div>
        <div class="cp-approval-actions"><button type="button" class="btn btn-ghost btn-sm" data-act="remove-declined-account" data-id="${esc(a.id)}" aria-label="Remove ${esc(a.name)}">Remove</button></div></li>`).join('')}</ul></section>`;
    }
    html += `<div class="segmented sa-filter" role="group" aria-label="Filter by role">${filters.map(([k, label]) => {
      const n = k === 'all' ? activeAll.length : activeAll.filter(a => (k === 'admin' ? (a.role === 'admin' || a.role === 'owner') : a.role === k)).length;
      return `<button type="button" class="seg-btn" data-sa-filter="${k}" aria-pressed="${saFilter === k}">${label} <span class="seg-count">${n}</span></button>`;
    }).join('')}</div>`;
    const shown = activeAll.filter(inFilter);
    html += shown.length ? `<ul class="sa-list">${shown.map(accountRowHTML).join('')}</ul>` : '<p class="an-empty">No accounts here yet.</p>';
    el('sa-root').innerHTML = html;
  }

  /* Two-factor email verification for the PERSON whose account is being created:
     after the form, a 6-digit code goes to THEIR email address. Whoever is creating the account
     types the code the person reads out. The account is not created until the code matches, so
     every account starts with an email that is proven to belong to its owner. Changing an existing
     account's email triggers the same check.
     PHASE 2 TODO: the SERVER generates and emails the code to the new person, expires it (5 min),
     rate-limits it (3 tries) and verifies it, then creates the account with emailVerified = true.
     The browser never sees the real code. Here it is shown on screen (prototype only) because no
     email is really sent. */

  function commitNewAccount(d){
    const owner = isOwnerUser();
    const id = generateStaffId();                      // PHASE 2 TODO: returned by the backend
    const acc = { id, staffId:id, email:d.email, emailVerified:true, name:d.name, role:d.role, mobile:d.mobile, status:'pending', tempPassword:d.pw };
    if (!owner){ acc.requestedBy = { id:currentUser.id, name:currentUser.name }; acc.requestedAt = new Date().toISOString(); }
    DEMO_ACCOUNTS.push(acc);
    if (owner){
      const pass = activateAccount(acc);
      saNotice = { type:'success', html:credentialsHTML(acc, pass) };
      showToast('Account created');
    } else {
      saNotice = { type:'success', html:`<strong>${esc(d.name)}</strong>'s ${ROLE_LABEL[d.role].toLowerCase()} account was sent to the Owner for approval. The system gave it the ID <code>${esc(id)}</code>, and their email address is verified. They can sign in once it is approved.` };
      showToast('Sent to the Owner for approval');
    }
    renderAccounts(); refreshBadges(); renderCourses(); renderClassCounter();
  }


  function openAccountEditor(id, trigger){
    const editing = id ? personById(id) : null;
    const owner = isOwnerUser();
    const roleLocked = !!editing && (!owner || editing.id === currentUser.id);
    const st = { role:editing ? editing.role : 'staff', name:editing ? editing.name : '', mobile:editing ? editing.mobile : '', email:editing ? (editing.email || '') : '', pw:'' };
    const body = `<div class="form-grid">
      ${edText('aname', 'Full name', { req:true, span:true, placeholder:'e.g. Rima Karim' })}
      ${edPicker('arole', 'Role', { req:true, disabled:roleLocked, hint: roleLocked ? (editing.id === currentUser.id ? 'You cannot change your own role.' : 'Only the Owner can change a role.') : '' })}
      ${edText('amobile', 'Mobile number', { req:true, type:'tel', inputmode:'tel', placeholder:'01XXXXXXXXX' })}
      ${edText('aemail', 'Email address', { req:true, span:true, type:'email', inputmode:'email', placeholder:'name@example.com', hint:'They can sign in with this email, and the system uses it to reach them.' })}
      ${edText('aid', 'Account ID', { span:true, disabled:true, placeholder:'Assigned by the system', hint: editing ? 'The ID cannot be changed.' : 'Generated by the system when the account is created. You do not enter it.' })}
      ${edText('apass', editing ? 'New temporary password (optional)' : 'Temporary password', { req:!editing, span:true, placeholder:'At least 6 characters', hint: editing ? 'Leave empty to keep the current password.' : '' })}
      <div class="span-2 ed-gen-row"><button type="button" class="link-btn" id="ed-gen">Generate a password</button></div>
    </div>`;
    const notice = !owner && !editing ? '<strong>This goes to the Owner for approval.</strong> The person can sign in once the Owner approves the account.' : '';

    const readForm = () => {
      st.name = el('ed-aname').value.trim(); st.mobile = cleanPhone(el('ed-amobile').value); st.email = el('ed-aemail').value.trim(); st.pw = el('ed-apass').value;
    };

    // ---- step 2 (new accounts only): verify it's you ----
    const verifyStep = (data, done, saveLabel, subtitle) => {
      const otp = newOtp();
      let coolUntil = Date.now() + 30000;
      return {
        title:'Verify the email address', subtitle, trigger, saveLabel,
        onBack:() => renderEditorStep(formStep()),
        body:`<p class="otp-lead">We sent a 6-digit code to <strong>${esc(maskEmail(data.email))}</strong>, the email address you entered for ${esc(data.name)}. Ask ${esc(data.name.split(' ')[0])} to read it out to you, then type it below. It expires in 5 minutes.</p>
          <div class="field" id="f-otp">
            <label for="ed-otp">Verification code<span class="req" aria-hidden="true">*</span></label>
            <input type="text" id="ed-otp" class="otp-input" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000">
            <div class="field-error"></div>
          </div>
          <div class="otp-row"><button type="button" class="link-btn" id="ed-resend" disabled>Send a new code</button></div>
          <div class="otp-demo">Prototype only: no email is really sent. The code for ${esc(data.email)} is <code id="otp-demo-code">${otp.code}</code></div>`,
        onOpen(){
          const tick = () => {
            const b = el('ed-resend');
            if (!b || !b.isConnected){ clearInterval(editorState.timer); return; }
            const left = Math.max(0, Math.ceil((coolUntil - Date.now()) / 1000));
            b.disabled = left > 0;
            b.textContent = left > 0 ? `Send a new code in ${left}s` : 'Send a new code';
          };
          editorState.timer = setInterval(tick, 1000); tick();
          el('ed-resend').addEventListener('click', () => {
            Object.assign(otp, newOtp()); coolUntil = Date.now() + 30000;
            el('otp-demo-code').textContent = otp.code; el('ed-otp').value = '';
            fieldMsg('f-otp', ''); el('editor-error').hidden = true; showToast('New code sent'); tick();
          });
          el('ed-otp').addEventListener('input', function(){ this.value = this.value.replace(/\D/g, '').slice(0, 6); });
        },
        onSave(){
          const bad = msg => ({ errors:[{ fieldId:'f-otp', msg }], banner:'The code was not accepted.' });
          const entered = el('ed-otp').value.replace(/\D/g, '');
          if (Date.now() > otp.expires) return bad('This code has expired. Tap "Send a new code".');
          if (otp.tries >= 3) return bad('Too many wrong tries. Tap "Send a new code".');
          if (entered.length !== 6) return bad('Enter the 6-digit code.');
          if (entered !== otp.code){
            otp.tries++;
            const left = 3 - otp.tries;
            return bad(left > 0 ? `That code isn't right. ${plural(left, 'try', 'tries')} left.` : 'Too many wrong tries. Tap "Send a new code".');
          }
          done();
          return {};
        }
      };
    };

    // ---- step 1: the form ----
    const formStep = () => ({
      title: editing ? 'Edit account' : 'Add account',
      subtitle: editing ? `ID ${editing.staffId}` : (owner ? '' : 'Step 1 of 2 · details'),
      notice, body, trigger,
      saveLabel: editing ? 'Save changes' : 'Continue',
      onOpen(){
        el('ed-aname').value = st.name; el('ed-amobile').value = st.mobile; el('ed-aemail').value = st.email; el('ed-apass').value = st.pw;
        el('ed-aid').value = editing ? editing.staffId : '';          // empty for new accounts: the backend assigns it
        const refreshRole = () => setPickerText('arole', ROLE_LABEL[st.role], 'Choose a role');
        refreshRole();
        el('ed-arole').addEventListener('click', () => openDrawer({
          title:'Role', subtitle: owner ? '' : 'Only the Owner can create Admin accounts', trigger:el('ed-arole'),
          options:rolesICanCreate().map(r => ({ value:r, label:ROLE_LABEL[r] })), value:st.role,
          onSelect:v => { st.role = v; refreshRole(); fieldMsg('f-arole', ''); }
        }));
        el('ed-amobile').addEventListener('input', function(){ this.value = this.value.replace(/[^\d+\s-]/g, ''); });
        el('ed-gen').addEventListener('click', () => { el('ed-apass').value = genPassword(); fieldMsg('f-apass', ''); });
      },
      onSave(){
        readForm();
        const errors = [], add = (f, msg) => errors.push({ fieldId:'f-' + f, msg });
        if (st.name.length < 2) add('aname', 'Type the full name.');
        if (!st.mobile) add('amobile', 'Type the mobile number: 11 digits, like 01712345678.');
        else if (!BD_MOBILE.test(st.mobile)) add('amobile', "This isn't a valid mobile number. Use 11 digits starting with 01.");
        if (!st.email) add('aemail', 'Type their email address.');
        else if (!EMAIL_RE.test(st.email)) add('aemail', "This email address doesn't look right. It should look like name@example.com.");
        else if (DEMO_ACCOUNTS.some(a => a.id !== (editing && editing.id) && (a.email || '').toLowerCase() === st.email.toLowerCase())) add('aemail', 'Another account already uses this email address.');
        if (!editing && st.pw.length < 6) add('apass', 'Use at least 6 characters, or tap "Generate a password".');
        else if (editing && st.pw && st.pw.length < 6) add('apass', 'Use at least 6 characters, or leave it empty to keep the current password.');
        if (errors.length) return { errors };

        const data = { name:st.name, role:st.role, mobile:st.mobile, email:st.email, pw:st.pw };
        if (!editing){
          return { next:verifyStep(data, () => commitNewAccount(data),
            owner ? 'Verify and create account' : 'Verify and send for approval', `Step 2 of 2 · verify ${st.name}'s email`) };
        }
        const applyEdit = () => {
          const wasTeaching = editing.role !== 'staff', u = DEMO_USERS.find(x => x.id === editing.id);
          Object.assign(editing, { name:st.name, mobile:st.mobile, email:st.email, emailVerified:true });
          if (!roleLocked) editing.role = st.role;
          if (u){ u.name = st.name; u.role = editing.role; if (st.pw) u.password = st.pw; }
          let note = '';
          if (wasTeaching && editing.role === 'staff'){ const n = unassignFromCourses(editing.id); if (n) note = ` They were removed from ${plural(n, 'course', 'courses')}.`; }
          if (editing.id === currentUser.id){ currentUser.name = st.name; document.querySelectorAll('#sheet-name,#sidebar-username').forEach(n => { n.textContent = st.name; }); }
          saNotice = st.pw ? { type:'success', html:credentialsHTML(editing, st.pw) } : null;
          showToast('Account updated.' + note);
          renderAccounts(); refreshBadges(); renderCourses(); renderClassCounter();
        };
        if (st.email.toLowerCase() !== (editing.email || '').toLowerCase()){      // a new email must be proven too
          return { next:verifyStep(data, applyEdit, 'Verify and save changes', `Verify ${st.name}'s new email`) };
        }
        applyEdit();
        return {};
      }
    });
    openEditor(formStep());
  }


  function initAccounts(){
    el('sa-root').addEventListener('click', e => {
      const f = e.target.closest('[data-sa-filter]');
      if (f){ saFilter = f.dataset.saFilter; renderAccounts(); const again = el('sa-root').querySelector(`[data-sa-filter="${saFilter}"]`); if (again && !isTouch()) again.focus({ preventScroll:true }); return; }
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act, acc = btn.dataset.id ? personById(btn.dataset.id) : null;
      if (act === 'dismiss-notice'){ saNotice = null; renderAccounts(); }
      else if (act === 'add-account') openAccountEditor(null, btn);
      else if (act === 'edit-account' && acc && canManageAccount(acc)) openAccountEditor(acc.id, btn);
      else if (act === 'approve-account' && isOwnerUser() && acc && acc.status === 'pending'){
        const pw = activateAccount(acc);
        saNotice = { type:'success', html:credentialsHTML(acc, pw) };
        showToast('Account approved'); renderAccounts(); refreshBadges();
      } else if (act === 'decline-account' && isOwnerUser() && acc){
        twoTap(btn, 'Tap again to decline', () => { acc.status = 'declined'; delete acc.tempPassword; saNotice = null; showToast('Account declined'); renderAccounts(); refreshBadges(); });
      } else if (act === 'remove-declined-account' && acc && acc.status === 'declined'){
        DEMO_ACCOUNTS.splice(DEMO_ACCOUNTS.indexOf(acc), 1); renderAccounts();
      } else if (act === 'delete-account' && acc && canDeleteAccount(acc)){
        twoTap(btn, 'Tap again to delete', () => {
          const n = unassignFromCourses(acc.id);
          DEMO_ACCOUNTS.splice(DEMO_ACCOUNTS.indexOf(acc), 1);
          const ui = DEMO_USERS.findIndex(u => u.id === acc.id); if (ui >= 0) DEMO_USERS.splice(ui, 1);
          saNotice = null;
          showToast(n ? `Account deleted. ${plural(n, 'course', 'courses')} lost a teacher.` : 'Account deleted');
          renderAccounts(); renderCourses(); renderClassCounter();
        });
      }
    });
  }


  function initAdminScreensForUser(){ cpNotice = null; saNotice = null; saFilter = 'all'; }

  // --- Wire up static elements ---
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('toggle-password').addEventListener('click', function(){
    const input = document.getElementById('input-password');
    const isPw = input.type === 'password';
    input.type = isPw ? 'text' : 'password';
    this.setAttribute('aria-label', isPw ? 'Hide password' : 'Show password');
  });
  document.getElementById('logout-btn-desktop').addEventListener('click', logOut);
  document.getElementById('logout-btn-mobile').addEventListener('click', logOut);

