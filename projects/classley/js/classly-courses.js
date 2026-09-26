"use strict";
/* Courses & Pricing screen. */

  const teachingPeople = () => DEMO_ACCOUNTS.filter(a => a.status === 'active' && ['teacher','admin','owner'].includes(a.role));

  const personName = id => { const a = personById(id); return a ? a.name : ''; };

  const personLabel = a => `${a.name} · ${ROLE_LABEL[a.role]}`;

  const digitsOf = v => parseInt(String(v).replace(/\D/g, ''), 10) || 0;

  const slugOf = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';

  const uniqueId = (base, list) => { let id = base, n = 2; while (list.some(x => x.id === id)) id = base + '-' + n++; return id; };

  const fmtDay = iso => new Date(iso).toLocaleDateString(undefined, { day:'numeric', month:'short' });


  let cpNotice = null;     // banner on Courses & Pricing: { type, html }

  const noticeHTML = (n, scope) => n ? `<div class="alert alert-${n.type}" role="${n.type === 'danger' ? 'alert' : 'status'}">
      ${n.type === 'danger' ? WARN_SVG : CHECK_SVG}<div class="alert-body">${n.html}</div>
      <button type="button" class="alert-close" data-act="dismiss-notice" aria-label="Dismiss message"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>` : '';

  /* ------------------------- COURSES & PRICING ------------------------- */

  function courseTeachersHTML(c){
    const sec = c.secondaryIds.map(personName).filter(Boolean);
    return `<dl class="cp-facts">
      <div><dt>Teacher</dt><dd>${c.teacher ? esc(c.teacher.name) : '<span class="cp-none">No teacher yet</span>'}</dd></div>
      <div><dt>Secondary</dt><dd>${sec.length ? esc(sec.join(', ')) : '<span class="cp-none">None</span>'}</dd></div>
      <div><dt>Classes</dt><dd>${c.planned}${c.batch ? ' · ' + esc(c.batch) : ''}${c.schedule ? ' · ' + esc(c.schedule) : ''}</dd></div>
    </dl>`;
  }


  function courseCardHTML(c){
    return `<article class="card cp-card" data-course="${c.id}">
      <div class="cp-card-head"><h2>${esc(c.name)}</h2><div class="cp-price">${money(c.price)}</div></div>
      ${c.meta ? `<p class="cp-meta">${esc(c.meta)}</p>` : ''}
      ${courseTeachersHTML(c)}
      <div class="cp-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-act="edit-course" data-id="${c.id}" aria-label="Edit ${esc(c.name)}">Edit</button>
        <button type="button" class="btn btn-ghost btn-sm is-reject" data-act="archive-course" data-id="${c.id}" aria-label="Archive ${esc(c.name)}">Archive</button>
      </div></article>`;
  }


  function packageCardHTML(p, archived){
    const names = p.includes.map(id => (ccCourse(id) || {}).name).filter(Boolean);
    const separate = p.includes.reduce((s, id) => s + ((ccCourse(id) || {}).price || 0), 0), save = separate - p.price;
    return `<article class="card cp-card" data-package="${p.id}">
      <div class="cp-card-head"><h2>${esc(p.name)}</h2><div class="cp-price">${money(p.price)}</div></div>
      <p class="cp-meta">Includes ${esc(names.join(', '))}</p>
      <div>${save > 0 ? `<span class="option-save">Saves ${money(save)}</span>` : '<span class="mini-tag">No saving</span>'}</div>
      <div class="cp-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-act="edit-package" data-id="${p.id}" aria-label="Edit ${esc(p.name)}">Edit</button>
        ${archived
          ? `<button type="button" class="btn btn-ghost btn-sm" data-act="restore-package" data-id="${p.id}" aria-label="Restore ${esc(p.name)}">Restore</button>`
          : `<button type="button" class="btn btn-ghost btn-sm is-reject" data-act="archive-package" data-id="${p.id}" aria-label="Archive ${esc(p.name)}">Archive</button>`}
      </div></article>`;
  }


  function renderCourses(){
    persist();
    if (!currentUser || !el('cp-root')) return;
    const owner = isOwnerUser();
    const by = st => DEMO_COURSES.filter(c => c.status === st);
    const active = by('active'), pending = by('pending'), declined = by('declined'), archived = by('archived');
    const pkgs = DEMO_PACKAGES.filter(p => p.status === 'active'), pkgArch = DEMO_PACKAGES.filter(p => p.status === 'archived');
    let html = noticeHTML(cpNotice);
    html += `<div class="cp-buttons">
      <button type="button" class="btn btn-primary btn-sm" data-act="add-course">Add course</button>
      <button type="button" class="btn btn-ghost btn-sm" data-act="add-package">New package</button></div>`;

    if (pending.length){
      html += `<section class="card cp-approvals" aria-labelledby="cp-h-pending"><div class="card-head"><h2 id="cp-h-pending">${owner ? 'Waiting for your approval' : 'Waiting for the Owner'}</h2><span class="count-pill">${pending.length}</span></div>
        <ul class="cp-list">${pending.map(c => `<li class="cp-approval">
          <div class="cp-approval-main"><div class="cp-approval-name">${esc(c.name)} <span class="cp-price-inline">${money(c.price)}</span></div>
            <div class="cp-approval-meta">Requested by ${esc(c.requestedBy ? c.requestedBy.name : 'an Admin')} · ${esc(fmtDay(c.requestedAt))}</div>
            ${courseTeachersHTML(c)}</div>
          ${owner ? `<div class="cp-approval-actions">
              <button type="button" class="btn btn-primary btn-sm" data-act="approve-course" data-id="${c.id}" aria-label="Approve ${esc(c.name)}">Approve</button>
              <button type="button" class="btn btn-ghost btn-sm" data-act="edit-course" data-id="${c.id}" aria-label="Edit ${esc(c.name)}">Edit</button>
              <button type="button" class="btn btn-ghost btn-sm is-reject" data-act="decline-course" data-id="${c.id}" aria-label="Decline ${esc(c.name)}">Decline</button></div>`
            : '<span class="pill pill-warning">Waiting for approval</span>'}
        </li>`).join('')}</ul></section>`;
    }
    if (declined.length){
      html += `<section class="card cp-approvals is-declined"><div class="card-head"><h2>Declined</h2></div><ul class="cp-list">${declined.map(c => `<li class="cp-approval">
        <div class="cp-approval-main"><div class="cp-approval-name">${esc(c.name)}</div><div class="cp-approval-meta">Declined by the Owner. Requested by ${esc(c.requestedBy ? c.requestedBy.name : 'an Admin')}.</div></div>
        <div class="cp-approval-actions"><button type="button" class="btn btn-ghost btn-sm" data-act="remove-declined" data-id="${c.id}" aria-label="Remove ${esc(c.name)}">Remove</button></div></li>`).join('')}</ul></section>`;
    }

    html += `<div class="cp-section-title"><h2 class="an-h">Courses</h2><span>${active.length} active</span></div>`;
    html += active.length ? `<div class="cp-grid">${active.map(courseCardHTML).join('')}</div>` : '<p class="an-empty">No active courses yet. Add one to get started.</p>';
    html += `<div class="cp-section-title"><h2 class="an-h">Packages</h2><span>${pkgs.length} active</span></div>`;
    html += pkgs.length ? `<div class="cp-grid">${pkgs.map(p => packageCardHTML(p, false)).join('')}</div>` : '<p class="an-empty">No packages yet.</p>';

    if (archived.length || pkgArch.length){
      html += `<details class="cp-archived"><summary>Archived (${archived.length + pkgArch.length})</summary>
        <p class="cp-note">Archived items are hidden from Registration and Class Counter. Their history is kept.</p><div class="cp-grid">
        ${archived.map(c => `<article class="card cp-card"><div class="cp-card-head"><h2>${esc(c.name)}</h2><div class="cp-price">${money(c.price)}</div></div>
          <div class="cp-actions"><button type="button" class="btn btn-ghost btn-sm" data-act="restore-course" data-id="${c.id}" aria-label="Restore ${esc(c.name)}">Restore</button></div></article>`).join('')}
        ${pkgArch.map(p => packageCardHTML(p, true)).join('')}</div></details>`;
    }
    el('cp-root').innerHTML = html;
  }


  function afterCatalogChange(){
    refreshCatalog(); renderCourses(); refreshBadges(); renderClassCounter();
  }


  function openCourseEditor(id, trigger){
    const editing = id ? DEMO_COURSES.find(c => c.id === id) : null;
    const owner = isOwnerUser();
    const canPickTeachers = !editing || owner;       // an Admin picks teachers only when creating (the Owner then approves)
    const st = { primary:editing ? editing.teacherId : '', secondary:editing ? editing.secondaryIds.slice() : [] };
    const people = teachingPeople();
    const body = `<div class="form-grid">
      ${edText('cname', 'Course name', { req:true, span:true, placeholder:'e.g. Spoken English — Basic' })}
      ${edText('cprice', 'Price', { req:true, money:true, inputmode:'numeric', placeholder:'0' })}
      ${edText('cplanned', 'Total classes', { req:true, inputmode:'numeric', placeholder:'e.g. 36', hint:'Class Counter tracks progress against this.' })}
      ${edText('cmeta', 'Details shown at registration', { span:true, placeholder:'e.g. 3 months · 2 classes/week' })}
      ${edText('cbatch', 'Batch', { placeholder:'e.g. Morning batch A' })}
      ${edText('cschedule', 'Schedule', { placeholder:'e.g. Sat · Mon · Wed, 8:00 AM' })}
      ${edPicker('cprimary', 'Primary teacher', { span:true, disabled:!canPickTeachers, hint:canPickTeachers ? 'The main teacher. They can tick this course\'s classes.' : 'Only the Owner can change teachers on an existing course.' })}
      ${edPicker('csecondary', 'Secondary teachers', { span:true, disabled:!canPickTeachers, hint:canPickTeachers ? 'Optional. They can also tick classes, for example when covering.' : '' })}
    </div>`;
    const notice = !owner && !editing
      ? '<strong>This goes to the Owner for approval.</strong> The course, and the teachers you pick, become active once the Owner approves it.'
      : (!owner && editing ? 'Changes to details and price take effect straight away.' : '');
    openEditor({
      title: editing ? 'Edit course' : 'Add course', subtitle: editing ? editing.name : '', notice, body, trigger,
      saveLabel: editing ? 'Save changes' : (owner ? 'Add course' : 'Send for approval'),
      onOpen(){
        el('ed-cname').value = editing ? editing.name : '';
        el('ed-cprice').value = editing ? String(editing.price) : '';
        el('ed-cplanned').value = editing ? String(editing.planned) : '';
        el('ed-cmeta').value = editing ? editing.meta : '';
        el('ed-cbatch').value = editing ? editing.batch : '';
        el('ed-cschedule').value = editing ? editing.schedule : '';
        ['ed-cprice','ed-cplanned'].forEach(i => el(i).addEventListener('input', function(){ this.value = this.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''); }));
        const refresh = () => {
          setPickerText('cprimary', personName(st.primary), 'Not assigned yet');
          setPickerText('csecondary', st.secondary.map(personName).filter(Boolean).join(', '), 'None');
        };
        refresh();
        el('ed-cprimary').addEventListener('click', () => openDrawer({
          title:'Primary teacher', subtitle:'The main teacher for this course', trigger:el('ed-cprimary'),
          options:[{ value:'', label:'Not assigned yet' }].concat(people.map(a => ({ value:a.id, label:personLabel(a) }))),
          value:st.primary,
          onSelect:v => { st.primary = v; st.secondary = st.secondary.filter(x => x !== v); refresh(); }
        }));
        el('ed-csecondary').addEventListener('click', () => openDrawer({
          title:'Secondary teachers', subtitle:'Tick everyone who can also take this course', trigger:el('ed-csecondary'), multi:true,
          options:people.filter(a => a.id !== st.primary).map(a => ({ value:a.id, label:personLabel(a) })),
          values:st.secondary, onToggle:vals => { st.secondary = vals; refresh(); }
        }));
      },
      onSave(){
        const v = i => el('ed-' + i).value.trim();
        const name = v('cname'), price = digitsOf(v('cprice')), planned = digitsOf(v('cplanned'));
        const errors = [], add = (f, msg) => errors.push({ fieldId:'f-' + f, msg });
        if (name.length < 2) add('cname', 'Type the course name.');
        else if (DEMO_COURSES.some(c => c.id !== (editing && editing.id) && c.status !== 'declined' && c.name.toLowerCase() === name.toLowerCase())) add('cname', 'A course with this name already exists.');
        if (price < 1) add('cprice', 'Enter the course fee in taka, more than 0.');
        if (planned < 1) add('cplanned', 'Enter how many classes the course has, like 36.');
        if (errors.length) return { errors };
        const fields = { name, price, planned, meta:v('cmeta'), batch:v('cbatch'), schedule:v('cschedule') };
        if (editing){
          Object.assign(editing, fields);
          if (canPickTeachers){ editing.teacherId = st.primary; editing.secondaryIds = st.secondary.slice(); }
          cpNotice = null;
          showToast('Course updated');
        } else {
          DEMO_COURSES.push(makeCourse(Object.assign({
            id:uniqueId('c-' + slugOf(name), DEMO_COURSES), teacherId:st.primary, secondaryIds:st.secondary.slice(),
            status:owner ? 'active' : 'pending',
            requestedBy:owner ? null : { id:currentUser.id, name:currentUser.name }, requestedAt:new Date().toISOString()
          }, fields)));
          cpNotice = owner ? null : { type:'success', html:`<strong>${esc(name)}</strong> was sent to the Owner for approval. It goes live, and its teachers can start ticking classes, once the Owner approves it.` };
          showToast(owner ? 'Course added' : 'Sent to the Owner for approval');
        }
        afterCatalogChange();
        return {};
      }
    });
  }


  function openPackageEditor(id, trigger){
    const editing = id ? DEMO_PACKAGES.find(p => p.id === id) : null;
    const st = { includes:editing ? editing.includes.slice() : [] };
    const choices = classCourses();
    const body = `<div class="form-grid">
      ${edText('pname', 'Package name', { req:true, span:true, placeholder:'e.g. Spoken English Complete' })}
      ${edText('pprice', 'Package price', { req:true, money:true, inputmode:'numeric', placeholder:'0' })}
      ${edPicker('pincludes', 'Courses in this package', { req:true, span:true, hint:'Pick at least two.' })}
    </div>`;
    openEditor({
      title: editing ? 'Edit package' : 'New package', subtitle: editing ? editing.name : '',
      body, trigger, saveLabel: editing ? 'Save changes' : 'Add package',
      notice: 'A package sells several courses together for one price. Registration adds them all and does not bill them twice.',
      onOpen(){
        el('ed-pname').value = editing ? editing.name : '';
        el('ed-pprice').value = editing ? String(editing.price) : '';
        const hint = () => {
          const sep = st.includes.reduce((s, cid) => s + ((ccCourse(cid) || {}).price || 0), 0), price = digitsOf(el('ed-pprice').value);
          setPickerText('pincludes', st.includes.map(cid => (ccCourse(cid) || {}).name).filter(Boolean).join(', '), 'Choose courses');
          el('hint-pincludes').textContent = st.includes.length < 2 ? 'Pick at least two.'
            : `Bought separately these cost ${money(sep)}.` + (price ? (sep - price > 0 ? ` This package saves ${money(sep - price)}.` : ' This package does not save anything.') : '');
        };
        hint();
        el('ed-pprice').addEventListener('input', function(){ this.value = this.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''); hint(); });
        el('ed-pincludes').addEventListener('click', () => openDrawer({
          title:'Courses in this package', subtitle:'Tick every course to include', trigger:el('ed-pincludes'), multi:true,
          options:choices.concat(st.includes.map(ccCourse).filter(c => c && c.status !== 'active')).map(c => ({ value:c.id, label:`${c.name} · ${money(c.price)}` })),
          values:st.includes, onToggle:vals => { st.includes = vals; hint(); }
        }));
      },
      onSave(){
        const name = el('ed-pname').value.trim(), price = digitsOf(el('ed-pprice').value);
        const errors = [], add = (f, msg) => errors.push({ fieldId:'f-' + f, msg });
        if (name.length < 2) add('pname', 'Type the package name.');
        else if (DEMO_PACKAGES.some(p => p.id !== (editing && editing.id) && p.name.toLowerCase() === name.toLowerCase())) add('pname', 'A package with this name already exists.');
        if (price < 1) add('pprice', 'Enter the package price in taka, more than 0.');
        if (st.includes.length < 2) add('pincludes', 'Choose at least two courses for a package.');
        if (errors.length) return { errors };
        if (editing){ Object.assign(editing, { name, price, includes:st.includes.slice() }); showToast('Package updated'); }
        else { DEMO_PACKAGES.push({ id:uniqueId('p-' + slugOf(name), DEMO_PACKAGES), name, price, includes:st.includes.slice(), status:'active' }); showToast('Package added'); }
        cpNotice = null;
        afterCatalogChange();
        return {};
      }
    });
  }


  function goToEditCourse(id){ setActiveNav('courses'); openCourseEditor(id); }


  function initCourses(){
    el('cp-root').addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act, id = btn.dataset.id;
      const course = DEMO_COURSES.find(c => c.id === id), pkg = DEMO_PACKAGES.find(p => p.id === id);
      if (act === 'dismiss-notice'){ cpNotice = null; renderCourses(); }
      else if (act === 'add-course') openCourseEditor(null, btn);
      else if (act === 'add-package') openPackageEditor(null, btn);
      else if (act === 'edit-course') openCourseEditor(id, btn);
      else if (act === 'edit-package') openPackageEditor(id, btn);
      else if (act === 'approve-course' && isOwnerUser() && course){
        course.status = 'active';
        cpNotice = { type:'success', html:`<strong>${esc(course.name)}</strong> is approved and live. It now shows in Registration${course.teacher ? `, and ${esc(course.teacher.name)} can tick its classes` : ''}.` };
        showToast('Course approved'); afterCatalogChange();
      } else if (act === 'decline-course' && isOwnerUser() && course){
        twoTap(btn, 'Tap again to decline', () => { course.status = 'declined'; cpNotice = null; showToast('Course declined'); afterCatalogChange(); });
      } else if (act === 'remove-declined' && course && course.status === 'declined'){
        DEMO_COURSES.splice(DEMO_COURSES.indexOf(course), 1); afterCatalogChange();
      } else if (act === 'archive-course' && course){
        const inPkgs = DEMO_PACKAGES.filter(p => p.status === 'active' && p.includes.includes(id));
        if (inPkgs.length){
          cpNotice = { type:'danger', html:`<strong>${esc(course.name)}</strong> is part of ${inPkgs.map(p => esc(p.name)).join(' and ')}. Edit or archive ${inPkgs.length > 1 ? 'those packages' : 'that package'} first.` };
          renderCourses(); window.scrollTo({ top:0, behavior:scrollBehavior() });
        } else twoTap(btn, 'Tap again to archive', () => { course.status = 'archived'; cpNotice = null; showToast('Course archived'); afterCatalogChange(); });
      } else if (act === 'restore-course' && course){ course.status = 'active'; showToast('Course restored'); afterCatalogChange(); }
      else if (act === 'archive-package' && pkg) twoTap(btn, 'Tap again to archive', () => { pkg.status = 'archived'; showToast('Package archived'); afterCatalogChange(); });
      else if (act === 'restore-package' && pkg){
        const ok = pkg.includes.every(cid => (ccCourse(cid) || {}).status === 'active');
        if (!ok){ cpNotice = { type:'danger', html:`<strong>${esc(pkg.name)}</strong> includes an archived course. Restore that course first.` }; renderCourses(); window.scrollTo({ top:0, behavior:scrollBehavior() }); }
        else { pkg.status = 'active'; showToast('Package restored'); afterCatalogChange(); }
      }
    });
  }

  /* ------------------------- STAFF ACCOUNTS ------------------------- */
