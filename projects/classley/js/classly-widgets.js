"use strict";
/* Generic UI building blocks used by more than one screen: the bottom-sheet Drawer
   picker, the Editor Sheet (course/package/account forms), and the on-screen-keyboard
   watcher that hides fixed bars while a text field is focused. */

  const drawerState = { open:false, multi:false, options:[], value:'', values:new Set(), onSelect:null, onToggle:null, trigger:null };


  function drawerVisibleOptions(){
    return [...el('drawer-list').querySelectorAll('.drawer-opt')];
  }


  function renderDrawerList(){
    const q = el('drawer-search').value.trim().toLowerCase();
    const items = drawerState.options.filter(o => !q || o.label.toLowerCase().includes(q));
    el('drawer-list').innerHTML = items.length
      ? items.map(o => {
          const sel = drawerState.multi ? drawerState.values.has(o.value) : o.value === drawerState.value;
          return `<li role="presentation"><button type="button" role="option" class="drawer-opt${sel ? ' is-selected' : ''}"
                    aria-selected="${sel}" data-value="${esc(o.value)}"><span>${esc(o.label)}</span>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button></li>`;
        }).join('')
      : `<li class="drawer-empty">${drawerState.options.length ? `Nothing matches "${esc(el('drawer-search').value.trim())}".` : 'Nothing to choose from yet.'}</li>`;
  }

  // Single choice: onSelect(value) and the drawer closes.
  // Multiple choice (multi:true): onToggle(values[]) on every tap, and a Done button closes it.

  function openDrawer(cfg){
    Object.assign(drawerState, {
      open:true, multi:!!cfg.multi, options:cfg.options, value:cfg.value, values:new Set(cfg.values || []),
      onSelect:cfg.onSelect || null, onToggle:cfg.onToggle || null, trigger:cfg.trigger || null
    });
    el('drawer-title').textContent = cfg.title;
    el('drawer-sub').textContent = cfg.subtitle || '';
    el('drawer-sub').hidden = !cfg.subtitle;
    el('drawer-search').value = '';
    el('drawer-search-wrap').hidden = cfg.options.length <= 10;   // search only earns its place on long lists
    el('drawer-foot').hidden = !drawerState.multi;
    el('drawer-list').setAttribute('aria-multiselectable', String(drawerState.multi));
    renderDrawerList();
    el('drawer-backdrop').classList.add('active');
    document.body.classList.add('drawer-open');
    // Bring the current choice into view, and focus it (a button, so no keyboard pops up on phones).
    requestAnimationFrame(() => {
      const list = el('drawer-list'), cur = list.querySelector('.is-selected');
      if (cur) list.scrollTop = Math.max(0, cur.offsetTop - list.clientHeight / 2 + cur.offsetHeight / 2);
      (cur || list.querySelector('.drawer-opt') || el('drawer-close')).focus({ preventScroll:true });
    });
  }


  function closeDrawer(){
    if (!drawerState.open) return;
    drawerState.open = false;
    el('drawer-backdrop').classList.remove('active');
    document.body.classList.remove('drawer-open');
    const t = drawerState.trigger;
    if (t) t.focus({ preventScroll:true });
  }


  function initDrawer(){
    el('drawer-backdrop').addEventListener('click', e => { if (e.target === e.currentTarget) closeDrawer(); });
    el('drawer-close').addEventListener('click', closeDrawer);
    el('drawer-done').addEventListener('click', closeDrawer);
    el('drawer-search').addEventListener('input', renderDrawerList);
    el('drawer-list').addEventListener('click', e => {
      const b = e.target.closest('.drawer-opt');
      if (!b) return;
      const value = b.dataset.value;
      if (drawerState.multi){
        const set = drawerState.values;
        if (set.has(value)) set.delete(value); else set.add(value);
        const list = el('drawer-list'), top = list.scrollTop;
        renderDrawerList();
        list.scrollTop = top;
        const again = drawerVisibleOptions().find(x => x.dataset.value === value);
        if (again) again.focus({ preventScroll:true });
        if (drawerState.onToggle) drawerState.onToggle([...set]);
        return;
      }
      const cb = drawerState.onSelect;
      closeDrawer();
      if (cb) cb(value);
    });
    document.addEventListener('keydown', e => {
      if (!drawerState.open) return;
      if (e.key === 'Escape'){ e.preventDefault(); closeDrawer(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
        const opts = drawerVisibleOptions();
        if (!opts.length) return;
        e.preventDefault();
        const i = opts.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? Math.min(opts.length - 1, i + 1) : Math.max(0, i - 1);
        opts[next < 0 ? 0 : next].focus();
        return;
      }
      if (e.key === 'Tab'){                       // keep focus inside the open dialog
        const f = [...el('drawer').querySelectorAll('button, input')].filter(n => !n.closest('[hidden]') && !n.disabled);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ============================================================
     EDITOR SHEET (bottom sheet on phones, centred dialog on desktop)
     One shared form container for Courses, Packages and Accounts.
       openEditor({ title, subtitle, notice, body, saveLabel, onOpen(bodyEl), onSave() })
     onSave() returns { errors:[{fieldId, msg}] } to keep the sheet open, or anything else once saved.
     ============================================================ */

  const editorState = { open:false, onSave:null, onBack:null, timer:null, trigger:null };

  const CHEV = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // Form field builders (ids become f-<id> for the wrapper and ed-<id> for the control)

  const edText = (id, label, o = {}) => `
    <div class="field${o.span ? ' span-2' : ''}" id="f-${id}">
      <label for="ed-${id}">${label}${o.req ? '<span class="req" aria-hidden="true">*</span>' : ''}</label>
      ${o.money ? '<div class="money-input"><span class="prefix" aria-hidden="true">৳</span>' : ''}
      <input type="${o.type || 'text'}" id="ed-${id}"${o.inputmode ? ` inputmode="${o.inputmode}"` : ''}${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}${o.disabled ? ' disabled' : ''} autocomplete="off">
      ${o.money ? '</div>' : ''}
      ${o.hint ? `<div class="field-hint" id="hint-${id}">${o.hint}</div>` : ''}
      <div class="field-error"></div>
    </div>`;

  const edPicker = (id, label, o = {}) => `
    <div class="field${o.span ? ' span-2' : ''}" id="f-${id}">
      <label for="ed-${id}" id="lbl-${id}">${label}${o.req ? '<span class="req" aria-hidden="true">*</span>' : ''}</label>
      <button type="button" class="picker is-placeholder" id="ed-${id}" aria-haspopup="dialog" aria-labelledby="lbl-${id} ed-${id}"${o.disabled ? ' disabled' : ''}>
        <span class="picker-label"></span>${CHEV}
      </button>
      ${o.hint ? `<div class="field-hint" id="hint-${id}">${o.hint}</div>` : ''}
      <div class="field-error"></div>
    </div>`;

  function setPickerText(id, text, placeholder){
    const b = el('ed-' + id);
    b.querySelector('.picker-label').textContent = text || placeholder;
    b.classList.toggle('is-placeholder', !text);
  }

  // Shows one step of the sheet. A step can return { next: <step> } from onSave to move on
  // (used for the two-step account verification), and give onBack to return.

  function renderEditorStep(cfg){
    clearInterval(editorState.timer);
    editorState.onSave = cfg.onSave;
    editorState.onBack = cfg.onBack || null;
    el('editor-title').textContent = cfg.title;
    el('editor-sub').textContent = cfg.subtitle || '';
    el('editor-sub').hidden = !cfg.subtitle;
    el('editor-body').innerHTML = (cfg.notice ? `<div class="alert alert-info">${CHECK_INFO}<div class="alert-body">${cfg.notice}</div></div>` : '') + cfg.body;
    el('editor-save').querySelector('.btn-label').textContent = cfg.saveLabel || 'Save';
    el('editor-cancel').textContent = cfg.onBack ? 'Back' : 'Cancel';
    el('editor-error').hidden = true;
    el('editor-body-wrap').scrollTop = 0;
    if (cfg.onOpen) cfg.onOpen(el('editor-body'));
    // Phones: never focus a text field (it would pop the keyboard). Desktop: start on the first field.
    if (!isTouch()){ const first = el('editor-body').querySelector('input:not([disabled]), textarea'); if (first) first.focus({ preventScroll:true }); }
    else el('editor').focus({ preventScroll:true });
  }


  function openEditor(cfg){
    editorState.trigger = cfg.trigger || document.activeElement;
    editorState.open = true;
    el('editor-backdrop').classList.add('active');
    document.body.classList.add('editor-open');
    renderEditorStep(cfg);
  }


  function closeEditor(){
    if (!editorState.open) return;
    editorState.open = false;
    clearInterval(editorState.timer);
    el('editor-backdrop').classList.remove('active');
    document.body.classList.remove('editor-open');
    const t = editorState.trigger;
    if (t && t.isConnected && !isTouch()) t.focus({ preventScroll:true });
  }


  function saveEditor(){
    const res = editorState.onSave ? editorState.onSave() : null;
    if (res && res.errors && res.errors.length){
      el('editor-body').querySelectorAll('.field.has-error').forEach(f => fieldMsg(f.id, ''));
      res.errors.forEach(er => fieldMsg(er.fieldId, er.msg));
      const n = res.errors.length;
      el('editor-error').textContent = res.banner || (n === 1 ? 'One thing needs fixing before you can save.' : `${n} things need fixing before you can save.`);
      el('editor-error').hidden = false;
      const first = el(res.errors[0].fieldId);
      if (first) first.scrollIntoView({ block:'center', behavior:scrollBehavior() });
      return;
    }
    if (res && res.next){ renderEditorStep(res.next); return; }
    closeEditor();
  }


  function initEditor(){
    el('editor-close').addEventListener('click', closeEditor);
    el('editor-cancel').addEventListener('click', () => { if (editorState.onBack) editorState.onBack(); else closeEditor(); });
    el('editor-save').addEventListener('click', saveEditor);
    const clear = e => {
      const f = e.target.closest('.field');
      if (f && f.classList.contains('has-error')) fieldMsg(f.id, '');
      if (!el('editor-body').querySelector('.field.has-error')) el('editor-error').hidden = true;   // last problem fixed
    };
    el('editor-body').addEventListener('input', clear);
    el('editor-body').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT'){ e.preventDefault(); saveEditor(); } });
    document.addEventListener('keydown', e => {
      if (!editorState.open || drawerState.open) return;
      if (e.key === 'Escape'){ e.preventDefault(); closeEditor(); return; }
      if (e.key === 'Tab'){
        const f = [...el('editor').querySelectorAll('button, input, textarea')].filter(n => !n.closest('[hidden]') && !n.disabled);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    });
  }

  const CHECK_INFO = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5M12 7.5v.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  /* ============================================================
     ON-SCREEN KEYBOARD: while a text field is focused on a touch device, hide the bottom
     nav and floating totals bar (Android lifts fixed bars above the keyboard).
     ============================================================ */

  function initKeyboardWatch(){
    const isText = t => !!t && (t.tagName === 'TEXTAREA' ||
      (t.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|hidden|range|file)$/.test(t.type)));
    const viewH = () => window.visualViewport ? window.visualViewport.height : window.innerHeight;
    let baseH = Math.max(window.innerHeight, viewH());      // height with no keyboard showing
    const shrunk = () => baseH - viewH() > 150;              // a keyboard is far taller than any browser bar
    const set = on => document.body.classList.toggle('kb-open', on);

    // Trust the measured viewport, not focus. On Android the back button closes the keyboard
    // WITHOUT blurring the field, so a focus-only flag would leave the toolbar hidden forever.
    let graceUntil = 0;                                      // the keyboard takes ~0.5s to slide in
    const sync = () => {
      if (!isText(document.activeElement)){ set(false); graceUntil = 0; baseH = Math.max(window.innerHeight, viewH()); return; }
      if (isTouch() && shrunk()){ set(true); return; }
      if (Date.now() < graceUntil) return;                   // still animating in: keep the bars hidden
      set(false);
    };
    document.addEventListener('focusin', e => {
      if (isTouch() && isText(e.target)){ graceUntil = Date.now() + 650; set(true); setTimeout(sync, 700); }   // hide at once, then verify
    });
    document.addEventListener('focusout', () => setTimeout(sync, 80));
    window.addEventListener('resize', () => setTimeout(sync, 60));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => setTimeout(sync, 60));
    // Safety net: a touch anywhere that isn't a text field re-checks the state.
    document.addEventListener('pointerdown', e => {
      if (document.body.classList.contains('kb-open') && !isText(e.target)) setTimeout(sync, 350);
    }, true);
  }

  /* ============================================================
     CLASS COUNTER
     Rules (from the client):
       - Each course/batch has a teacher. The teacher ticks "today's class taken".
       - Teachers are set on the course (Courses & Pricing): one primary teacher plus optional
         secondary teachers. Either can tick, but only one tick per course per day. Nobody can tick a
         course they are not assigned to. When an Admin creates a course, the Owner must approve it
         first, so the teachers the Admin picked can only tick after approval.
       - A tick is PENDING until someone else confirms it. Admin can confirm others' ticks (not
         their own); the Owner can confirm anyone's. So an Admin's own tick waits for the Owner.
       - The Owner's own ticks are confirmed automatically.
     PHASE 2 TODO: replace the shared course catalogue (DEMO_COURSES) and DEMO_CLASS_LOG with
       GET /api/classes, POST /api/classes/:id/ticks, DELETE /api/ticks/:id,
       PATCH /api/ticks/:id { status: "confirmed" | "rejected" },
       teachers are stored on the course (see Courses & Pricing).
       The server must enforce: a teacher can tick only their own courses; one tick per course
       per day; that the caller is a teacher of the course; who may confirm what (above); auto-confirm
       for the Owner. Never trust the client.
     ============================================================ */
