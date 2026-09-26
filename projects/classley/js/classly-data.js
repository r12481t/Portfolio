"use strict";
/* Shared demo data: accounts, courses, packages, registrations, class log, and the
   localStorage persistence that keeps a visitor's changes across a reload. */

  const DEMO_USERS = [
    { id:'owner@classly.test',   password:'owner123',   role:'owner',   name:'Tanvir Chowdhury' },
    { id:'admin@classly.test',   password:'admin123',   role:'admin',   name:'Admin User' },
    { id:'teacher@classly.test', password:'teacher123', role:'teacher', name:'Rima Karim' },
    { id:'staff@classly.test',   password:'staff123',   role:'staff',   name:'Sabbir Hossain' },
    // More people who can sign in. They are not listed in the review-only demo panel.
    { id:'imran@classly.test',   password:'imran123',   role:'teacher', name:'Imran Hossain',  demoPanel:false },
    { id:'nasrin@classly.test',  password:'nasrin123',  role:'teacher', name:'Nasrin Akter',   demoPanel:false },
    { id:'tania@classly.test',   password:'tania123',   role:'staff',   name:'Tania Rahman',   demoPanel:false },
    { id:'mahin@classly.test',   password:'mahin123',   role:'staff',   name:'Mahin Ahmed',    demoPanel:false }
  ];


  const ICONS = {
    home:`<path d="M3 11.5 12 4l9 7.5M5 10v10h14V10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
    registration:`<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
    classcounter:`<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
    courses:`<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
    staffaccounts:`<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M12.5 3.5a4 4 0 1 1 0 8M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
    analytics:`<path d="M3 3v18h18M8 17V10M13 17V6M18 17v-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
    more:`<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>`
  };

  function icon(name){
    return `<svg viewBox="0 0 24 24" fill="none">${ICONS[name]||''}</svg>`;
  }

  // Every possible destination. `roles` controls who sees it.

  const NAV_ITEMS = [
    { id:'home',          label:'Home',                 short:'Home',     section:'home',          roles:['owner','admin','teacher','staff'] },
    { id:'classcounter',  label:'Class Counter',         short:'Counter',  section:'classcounter',  roles:['owner','admin','teacher'] },
    { id:'registration',  label:'Course Registration',   short:'Register', section:'registration',  roles:['owner','admin','teacher','staff'] },
    { id:'courses',       label:'Courses & Pricing',     short:'Courses',  section:'courses',       roles:['owner','admin'] },
    { id:'staffaccounts', label:'Staff Accounts',        short:'Staff',    section:'staffaccounts', roles:['owner','admin'] },
    { id:'analytics',     label:'Analytics',             section:'analytics',     roles:['owner','admin','teacher','staff'],
      labelFor:{ teacher:'My Analytics', staff:'My Analytics' },
      short:'Analytics', shortFor:{ teacher:'My stats', staff:'My stats' } }
  ];


  const QUICK_ACTIONS = {
    staff:   ['registration','analytics'],
    teacher: ['classcounter','registration','analytics'],
    admin:   ['classcounter','registration','analytics'],
    owner:   ['classcounter','registration','analytics']
  };


  let currentUser = null;

  let currentSection = 'home';


  const DEMO_ACCOUNTS = [
    { id:'owner@classly.test', staffId:'CL-1001', email:'owner@classly.test',   name:'Tanvir Chowdhury',         role:'owner',   mobile:'01711000001', status:'active' },
    { id:'admin@classly.test', staffId:'CL-1002', email:'admin@classly.test',   name:'Admin User',     role:'admin',   mobile:'01711000002', status:'active' },
    { id:'teacher@classly.test', staffId:'CL-1003', email:'teacher@classly.test', name:'Rima Karim',     role:'teacher', mobile:'01711000003', status:'active' },
    { id:'imran@classly.test', staffId:'CL-1004', email:'imran@classly.test',   name:'Imran Hossain',  role:'teacher', mobile:'01711000004', status:'active' },
    { id:'nasrin@classly.test', staffId:'CL-1005', email:'nasrin@classly.test',  name:'Nasrin Akter',   role:'teacher', mobile:'01711000005', status:'active' },
    { id:'staff@classly.test', staffId:'CL-1006', email:'staff@classly.test',   name:'Sabbir Hossain', role:'staff',   mobile:'01711000006', status:'active' },
    { id:'tania@classly.test', staffId:'CL-1007', email:'tania@classly.test',   name:'Tania Rahman',   role:'staff',   mobile:'01711000007', status:'active' },
    { id:'mahin@classly.test', staffId:'CL-1008', email:'mahin@classly.test',   name:'Mahin Ahmed',    role:'staff',   mobile:'01711000008', status:'active' }
  ];

  const personById = id => DEMO_ACCOUNTS.find(a => a.id === id) || null;
  /* Account IDs are generated by the BACKEND, never typed or derived from a name in the browser.
     PHASE 2 TODO: POST /api/users returns the new ID. This counter only stands in for that. */

  let staffIdSeq = 1008;

  const generateStaffId = () => 'CL-' + (++staffIdSeq);

  /* One catalogue feeds Registration (price, details), Class Counter (teachers, batch, class count)
     and Analytics. status: 'active' | 'pending' (Admin created it, Owner must approve) | 'declined' | 'archived'.
     teacherId is the primary teacher; secondaryIds can also tick classes (e.g. to cover).
     PHASE 2 TODO: GET/POST/PATCH /api/courses and /api/packages; the server enforces approval. */

  function makeCourse(o){
    const c = Object.assign({ meta:'', batch:'', schedule:'', teacherId:'', secondaryIds:[], baseTotal:0, planned:12, status:'active' }, o);
    Object.defineProperty(c, 'teacher', { get(){ return c.teacherId ? personById(c.teacherId) : null; }, enumerable:false });
    return c;
  }

  const DEMO_COURSES = [
    makeCourse({ id:'c-spoken-basic', name:'Spoken English — Basic',    meta:'3 months · 2 classes/week', price:4500,
      batch:'Morning batch A', schedule:'Sat · Mon · Wed, 8:00 AM', teacherId:'teacher@classly.test', secondaryIds:['imran@classly.test'], baseTotal:23, planned:36 }),
    makeCourse({ id:'c-spoken-adv',   name:'Spoken English — Advanced', meta:'3 months · 3 classes/week', price:6000,
      batch:'Evening batch',   schedule:'Mon · Wed · Thu, 7:30 PM', teacherId:'', baseTotal:17, planned:36 }),
    makeCourse({ id:'c-grammar',      name:'Grammar Foundation',        meta:'6 weeks · 2 classes/week',  price:3000,
      batch:'Friday batch',    schedule:'Fri · Sat, 4:00 PM',       teacherId:'imran@classly.test', secondaryIds:['teacher@classly.test'], baseTotal:9, planned:12 }),
    makeCourse({ id:'c-writing',      name:'Writing Skills',            meta:'2 months · 2 classes/week', price:3500,
      batch:'Morning batch',   schedule:'Sat · Tue, 9:00 AM',       teacherId:'owner@classly.test', baseTotal:5, planned:16 }),
    makeCourse({ id:'c-business',     name:'Business English',          meta:'2 months · 2 classes/week', price:5500,
      batch:'Weekend batch',   schedule:'Fri · Sat, 10:00 AM',      teacherId:'nasrin@classly.test', baseTotal:7, planned:16 }),
    makeCourse({ id:'c-ielts',        name:'IELTS Preparation',         meta:'3 months · 3 classes/week', price:9500,
      batch:'Evening batch',   schedule:'Sun · Tue · Thu, 6:30 PM', teacherId:'teacher@classly.test', baseTotal:30, planned:36 }),
    makeCourse({ id:'c-kids',         name:'Kids English (ages 8–12)',  meta:'3 months · 2 classes/week', price:3500,
      batch:'After-school',    schedule:'Sun · Tue, 4:30 PM',       teacherId:'nasrin@classly.test', baseTotal:14, planned:24 })
  ];

  const DEMO_PACKAGES = [
    { id:'p-spoken-complete', name:'Spoken English Complete', includes:['c-spoken-basic','c-spoken-adv','c-grammar'], price:11500, status:'active' },
    { id:'p-ielts-fast',      name:'IELTS Fast Track',        includes:['c-ielts','c-writing','c-grammar'],           price:14000, status:'active' }
  ];

  const classCourses = () => DEMO_COURSES.filter(c => c.status === 'active');

  const DEMO_REGISTRATIONS = [];

  const REG_SEQ_START = 1042;

  // Division > District > Upazila (all 8 divisions, 64 districts).
  // PHASE 2 TODO: compiled by hand for this prototype. Replace with the official list
  // (BBS / LGD) served by GET /api/geo, and verify names before go-live. "Other (type it in)"
  // stays available as a safety valve. "City area" entries stand in for city-corporation thanas.

  const el = id => document.getElementById(id);

  const money = n => '৳' + Number(n || 0).toLocaleString('en-IN');

  const esc = s => String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  const emailHTML = e => esc(e).replace('@', '@<wbr>');   // lets a long address wrap after the @, never mid-word

  const scrollBehavior = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  // On touch devices, focusing a text field pops up the on-screen keyboard. We only
  // auto-focus fields when there's a real pointer + keyboard; on phones we just scroll.

  const isTouch = () => window.matchMedia('(pointer: coarse)').matches;

  const courseById = id => DEMO_COURSES.find(c => c.id === id);


  const TEACHERS = {      // only used to label the seeded history below
    rima:   { id:'teacher@classly.test', name:'Rima Karim',    role:'teacher' },
    imran:  { id:'imran@classly.test',   name:'Imran Hossain', role:'teacher' },
    nasrin: { id:'nasrin@classly.test',  name:'Nasrin Akter',  role:'teacher' },
    admin:  { id:'admin@classly.test',   name:'Admin User',    role:'admin' },
    owner:  { id:'owner@classly.test',   name:'Tanvir Chowdhury',        role:'owner' }
  };


  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const todayKey = () => dayKey(new Date());

  const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };

  const minutesAgo = m => new Date(Date.now() - m * 60000).toISOString();

  // One row per tick. status: 'pending' | 'confirmed' | 'rejected'

  let ccSeq = 100;

  const DEMO_CLASS_LOG = [
    { id:'t1', courseId:'c-grammar',  day:todayKey(),     at:minutesAgo(95),   by:TEACHERS.imran,  status:'pending',   decidedBy:null },
    { id:'t2', courseId:'c-business', day:todayKey(),     at:minutesAgo(40),   by:TEACHERS.nasrin, status:'pending',   decidedBy:null },
    { id:'t3', courseId:'c-kids',     day:yesterdayKey(), at:minutesAgo(1200), by:TEACHERS.nasrin, status:'pending',   decidedBy:null },
    { id:'t5', courseId:'c-spoken-basic',    day:yesterdayKey(), at:minutesAgo(1500), by:TEACHERS.rima,   status:'confirmed', decidedBy:{ name:'Admin User' } },
    { id:'t6', courseId:'c-ielts',    day:yesterdayKey(), at:minutesAgo(1250), by:TEACHERS.rima,   status:'rejected',  decidedBy:{ name:'Admin User' } }
  ];

  /* ============================================================
     PORTFOLIO DEMO: everything below keeps this visitor's changes
     across a reload by saving to their own browser (localStorage).
     Nothing is sent anywhere. `hydrate()` runs once at load, before
     anything renders; `persist()` runs at the top of every render*()
     function, since every action in this app is followed by a
     re-render, so that is the one place that reliably catches all
     of them.
     ============================================================ */

  const STORAGE_KEY = 'classly-demo-v1';

  const STORAGE_MAX_AGE_DAYS = 30;   // older saves are treated as stale and dropped, so the demo stays fresh for later visitors


  function persist(){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        savedAt: Date.now(),
        users: DEMO_USERS,
        accounts: DEMO_ACCOUNTS,
        courses: DEMO_COURSES,
        packages: DEMO_PACKAGES,
        registrations: DEMO_REGISTRATIONS,
        classLog: DEMO_CLASS_LOG,
        staffIdSeq, ccSeq
      }));
    } catch (e) { /* private browsing or a full quota: the demo still works, it just won't remember */ }
  }


  function hydrate(){
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { saved = null; }
    if (!saved || typeof saved !== 'object') return;
    if (!saved.savedAt || Date.now() - saved.savedAt > STORAGE_MAX_AGE_DAYS * 86400000) return;
    const replace = (arr, data) => { if (Array.isArray(data)){ arr.length = 0; arr.push(...data); } };
    replace(DEMO_USERS, saved.users);
    replace(DEMO_ACCOUNTS, saved.accounts);
    if (Array.isArray(saved.courses)){                 // rebuilt through makeCourse() so the `teacher` getter is restored
      DEMO_COURSES.length = 0;
      saved.courses.forEach(c => DEMO_COURSES.push(makeCourse(c)));
    }
    replace(DEMO_PACKAGES, saved.packages);
    replace(DEMO_REGISTRATIONS, saved.registrations);
    replace(DEMO_CLASS_LOG, saved.classLog);
    if (typeof saved.staffIdSeq === 'number') staffIdSeq = saved.staffIdSeq;
    if (typeof saved.ccSeq === 'number') ccSeq = saved.ccSeq;
  }

  function resetDemo(){
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* nothing to clear */ }
    location.reload();
  }


  const ROLE_LABEL = { owner:'Owner', admin:'Admin', teacher:'Teacher', staff:'Staff' };
