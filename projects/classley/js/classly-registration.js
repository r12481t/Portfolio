"use strict";
/* Course Registration screen. */

  const G = s => s.split(', ').sort((a, b) => a.localeCompare(b));

  const BD_GEO = {
    'Barishal': {
      'Barguna':    G('Amtali, Bamna, Barguna Sadar, Betagi, Patharghata, Taltali'),
      'Barishal':   G('Agailjhara, Babuganj, Bakerganj, Banaripara, Barishal Sadar, Gournadi, Hizla, Mehendiganj, Muladi, Wazirpur'),
      'Bhola':      G('Bhola Sadar, Burhanuddin, Char Fasson, Daulatkhan, Lalmohan, Manpura, Tazumuddin'),
      'Jhalokati':  G('Jhalokati Sadar, Kathalia, Nalchity, Rajapur'),
      'Patuakhali': G('Bauphal, Dashmina, Dumki, Galachipa, Kalapara, Mirzaganj, Patuakhali Sadar, Rangabali'),
      'Pirojpur':   G('Bhandaria, Kawkhali, Mathbaria, Nazirpur, Nesarabad, Pirojpur Sadar, Zianagar')
    },
    'Chattogram': {
      'Bandarban':    G('Alikadam, Bandarban Sadar, Lama, Naikhongchhari, Rowangchhari, Ruma, Thanchi'),
      'Brahmanbaria': G('Akhaura, Ashuganj, Bancharampur, Bijoynagar, Brahmanbaria Sadar, Kasba, Nabinagar, Nasirnagar, Sarail'),
      'Chandpur':     G('Chandpur Sadar, Faridganj, Haimchar, Haziganj, Kachua, Matlab Dakshin, Matlab Uttar, Shahrasti'),
      'Chattogram':   G('Anwara, Banshkhali, Boalkhali, Chandanaish, Chattogram City area, Fatikchhari, Hathazari, Karnaphuli, Lohagara, Mirsharai, Patiya, Rangunia, Raozan, Sandwip, Satkania, Sitakunda'),
      "Cox's Bazar":  G("Chakaria, Cox's Bazar Sadar, Eidgaon, Kutubdia, Maheshkhali, Pekua, Ramu, Teknaf, Ukhia"),
      'Cumilla':      G('Barura, Brahmanpara, Burichang, Chandina, Chauddagram, Cumilla Adarsha Sadar, Cumilla Sadar Dakshin, Daudkandi, Debidwar, Homna, Laksam, Lalmai, Meghna, Monohargonj, Muradnagar, Nangalkot, Titas'),
      'Feni':         G('Chhagalnaiya, Daganbhuiyan, Feni Sadar, Fulgazi, Parshuram, Sonagazi'),
      'Khagrachhari': G('Dighinala, Guimara, Khagrachhari Sadar, Lakshmichhari, Mahalchhari, Manikchhari, Matiranga, Panchhari, Ramgarh'),
      'Lakshmipur':   G('Kamalnagar, Lakshmipur Sadar, Raipur, Ramganj, Ramgati'),
      'Noakhali':     G('Begumganj, Chatkhil, Companiganj, Hatiya, Kabirhat, Noakhali Sadar, Senbagh, Sonaimuri, Subarnachar'),
      'Rangamati':    G('Baghaichhari, Barkal, Belaichhari, Juraichhari, Kaptai, Kawkhali, Langadu, Naniarchar, Rajasthali, Rangamati Sadar')
    },
    'Dhaka': {
      'Dhaka':       G('Dhaka City area, Dhamrai, Dohar, Keraniganj, Nawabganj, Savar'),
      'Faridpur':    G('Alfadanga, Bhanga, Boalmari, Charbhadrasan, Faridpur Sadar, Madhukhali, Nagarkanda, Sadarpur, Saltha'),
      'Gazipur':     G('Gazipur Sadar, Kaliakair, Kaliganj, Kapasia, Sreepur'),
      'Gopalganj':   G('Gopalganj Sadar, Kashiani, Kotalipara, Muksudpur, Tungipara'),
      'Kishoreganj': G('Austagram, Bajitpur, Bhairab, Hossainpur, Itna, Karimganj, Katiadi, Kishoreganj Sadar, Kuliarchar, Mithamain, Nikli, Pakundia, Tarail'),
      'Madaripur':   G('Kalkini, Madaripur Sadar, Rajoir, Shibchar'),
      'Manikganj':   G('Daulatpur, Ghior, Harirampur, Manikganj Sadar, Saturia, Shivalaya, Singair'),
      'Munshiganj':  G('Gazaria, Lohajang, Munshiganj Sadar, Sirajdikhan, Sreenagar, Tongibari'),
      'Narayanganj': G('Araihazar, Bandar, Narayanganj Sadar, Rupganj, Sonargaon'),
      'Narsingdi':   G('Belabo, Monohardi, Narsingdi Sadar, Palash, Raipura, Shibpur'),
      'Rajbari':     G('Baliakandi, Goalanda, Kalukhali, Pangsha, Rajbari Sadar'),
      'Shariatpur':  G('Bhedarganj, Damudya, Gosairhat, Naria, Shariatpur Sadar, Zajira'),
      'Tangail':     G('Basail, Bhuapur, Delduar, Dhanbari, Ghatail, Gopalpur, Kalihati, Madhupur, Mirzapur, Nagarpur, Sakhipur, Tangail Sadar')
    },
    'Khulna': {
      'Bagerhat':  G('Bagerhat Sadar, Chitalmari, Fakirhat, Kachua, Mollahat, Mongla, Morrelganj, Rampal, Sarankhola'),
      'Chuadanga': G('Alamdanga, Chuadanga Sadar, Damurhuda, Jibannagar'),
      'Jashore':   G('Abhaynagar, Bagherpara, Chaugachha, Jashore Sadar, Jhikargachha, Keshabpur, Manirampur, Sharsha'),
      'Jhenaidah': G('Harinakunda, Jhenaidah Sadar, Kaliganj, Kotchandpur, Maheshpur, Shailkupa'),
      'Khulna':    G('Batiaghata, Dacope, Dighalia, Dumuria, Khulna City area, Koyra, Paikgachha, Phultala, Rupsa, Terokhada'),
      'Kushtia':   G('Bheramara, Daulatpur, Khoksa, Kumarkhali, Kushtia Sadar, Mirpur'),
      'Magura':    G('Magura Sadar, Mohammadpur, Shalikha, Sreepur'),
      'Meherpur':  G('Gangni, Meherpur Sadar, Mujibnagar'),
      'Narail':    G('Kalia, Lohagara, Narail Sadar'),
      'Satkhira':  G('Assasuni, Debhata, Kalaroa, Kaliganj, Satkhira Sadar, Shyamnagar, Tala')
    },
    'Mymensingh': {
      'Jamalpur':   G('Bakshiganj, Dewanganj, Islampur, Jamalpur Sadar, Madarganj, Melandaha, Sarishabari'),
      'Mymensingh': G('Bhaluka, Dhobaura, Fulbaria, Gaffargaon, Gauripur, Haluaghat, Ishwarganj, Muktagachha, Mymensingh Sadar, Nandail, Phulpur, Tarakanda, Trishal'),
      'Netrokona':  G('Atpara, Barhatta, Durgapur, Kalmakanda, Kendua, Khaliajuri, Madan, Mohanganj, Netrokona Sadar, Purbadhala'),
      'Sherpur':    G('Jhenaigati, Nakla, Nalitabari, Sherpur Sadar, Sreebardi')
    },
    'Rajshahi': {
      'Bogura':           G('Adamdighi, Bogura Sadar, Dhunat, Dhupchanchia, Gabtali, Kahaloo, Nandigram, Sariakandi, Shajahanpur, Sherpur, Shibganj, Sonatala'),
      'Chapainawabganj':  G('Bholahat, Chapainawabganj Sadar, Gomastapur, Nachole, Shibganj'),
      'Joypurhat':        G('Akkelpur, Joypurhat Sadar, Kalai, Khetlal, Panchbibi'),
      'Naogaon':          G('Atrai, Badalgachhi, Dhamoirhat, Manda, Mohadevpur, Naogaon Sadar, Niamatpur, Patnitala, Porsha, Raninagar, Sapahar'),
      'Natore':           G('Bagatipara, Baraigram, Gurudaspur, Lalpur, Natore Sadar, Singra'),
      'Pabna':            G('Atgharia, Bera, Bhangura, Chatmohar, Faridpur, Ishwardi, Pabna Sadar, Santhia, Sujanagar'),
      'Rajshahi':         G('Bagha, Bagmara, Charghat, Durgapur, Godagari, Mohanpur, Paba, Puthia, Rajshahi City area, Tanore'),
      'Sirajganj':        G('Belkuchi, Chauhali, Kamarkhanda, Kazipur, Raiganj, Shahjadpur, Sirajganj Sadar, Tarash, Ullahpara')
    },
    'Rangpur': {
      'Dinajpur':    G('Birampur, Birganj, Biral, Bochaganj, Chirirbandar, Dinajpur Sadar, Ghoraghat, Hakimpur, Kaharole, Khansama, Nawabganj, Parbatipur, Phulbari'),
      'Gaibandha':   G('Gaibandha Sadar, Gobindaganj, Palashbari, Phulchhari, Sadullapur, Sughatta, Sundarganj'),
      'Kurigram':    G('Bhurungamari, Char Rajibpur, Chilmari, Kurigram Sadar, Nageshwari, Phulbari, Rajarhat, Raomari, Ulipur'),
      'Lalmonirhat': G('Aditmari, Hatibandha, Kaliganj, Lalmonirhat Sadar, Patgram'),
      'Nilphamari':  G('Dimla, Domar, Jaldhaka, Kishoreganj, Nilphamari Sadar, Saidpur'),
      'Panchagarh':  G('Atwari, Boda, Debiganj, Panchagarh Sadar, Tetulia'),
      'Rangpur':     G('Badarganj, Gangachara, Kaunia, Mithapukur, Pirgachha, Pirganj, Rangpur Sadar, Taraganj'),
      'Thakurgaon':  G('Baliadangi, Haripur, Pirganj, Ranishankail, Thakurgaon Sadar')
    },
    'Sylhet': {
      'Habiganj':    G('Ajmiriganj, Bahubal, Baniachong, Chunarughat, Habiganj Sadar, Lakhai, Madhabpur, Nabiganj, Shayestaganj'),
      'Moulvibazar': G('Barlekha, Juri, Kamalganj, Kulaura, Moulvibazar Sadar, Rajnagar, Sreemangal'),
      'Sunamganj':   G('Bishwamvarpur, Chhatak, Dakshin Sunamganj, Derai, Dharampasha, Dowarabazar, Jagannathpur, Jamalganj, Madhyanagar, Sullah, Sunamganj Sadar, Tahirpur'),
      'Sylhet':      G('Balaganj, Beanibazar, Bishwanath, Companiganj, Dakshin Surma, Fenchuganj, Golapganj, Gowainghat, Jaintiapur, Kanaighat, Osmani Nagar, Sylhet Sadar, Zakiganj')
    }
  };

  const ADDR_DEFAULT = { division:'Rangpur', district:'Rangpur', upazila:'Rangpur Sadar' };

  const OTHER = '__other';


  const BD_MOBILE = /^(?:\+?88)?01[3-9]\d{8}$/;

  const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const cleanPhone = v => v.replace(/[\s-]/g, '');

  const ADDR_PREFIXES = ['present','perm'];

  const ADDR_PARTS = ['div','dist','upz','upzother','village'];

  const FIELD_IDS = ['f-name','f-father','f-mother','f-mobile','f-email','f-wa','f-paid']
    .concat(ADDR_PREFIXES.flatMap(P => ADDR_PARTS.map(part => `f-${P}-${part}`)));


  const regState = { courses:new Set(), packages:new Set() };

  let summaryVisible = false;

  const pickers = {};   // 'present-div' -> { title, options:[{value,label}], value, placeholder, disabled }

  const pKey = (P, part) => `${P}-${part}`;

  const toOpts = list => list.map(v => ({ value:v, label:v }));

  const PICKER_TITLES = { div:'Division', dist:'District', upz:'Upazila' };

  const addrText = (P, part) => el(`reg-${P}-${part}`);   // text inputs (village, upzother)


  function addressBlockHTML(P){
    const chev = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const picker = (part, label) => `
      <div class="field" id="f-${P}-${part}">
        <label for="reg-${P}-${part}" id="lbl-${P}-${part}">${label}<span class="req" aria-hidden="true">*</span></label>
        <button type="button" class="picker is-placeholder" id="reg-${P}-${part}" aria-haspopup="dialog" aria-labelledby="lbl-${P}-${part} reg-${P}-${part}">
          <span class="picker-label"></span>${chev}
        </button>
        <div class="field-error"></div>
      </div>`;
    return picker('div','Division') + picker('dist','District') + picker('upz','Upazila') + `
      <div class="field" id="f-${P}-village">
        <label for="reg-${P}-village">Village<span class="req" aria-hidden="true">*</span></label>
        <input type="text" id="reg-${P}-village" required placeholder="Type the village name">
        <div class="field-error"></div>
      </div>
      <div class="field span-2 reveal" id="f-${P}-upzother">
        <label for="reg-${P}-upzother">Upazila name<span class="req" aria-hidden="true">*</span></label>
        <input type="text" id="reg-${P}-upzother" placeholder="Type the upazila name">
        <div class="field-error"></div>
      </div>`;
  }


  const pickerValue = (P, part) => pickers[pKey(P, part)].value;

  function renderPickerTrigger(P, part){
    const p = pickers[pKey(P, part)], btn = el(`reg-${P}-${part}`);
    const opt = p.options.find(o => o.value === p.value);
    btn.querySelector('.picker-label').textContent = opt ? opt.label : p.placeholder;
    btn.classList.toggle('is-placeholder', !opt);
    btn.disabled = !!p.disabled;
  }

  function pickerSet(P, part, options, value, placeholder, disabled){
    const p = pickers[pKey(P, part)];
    p.options = options; p.placeholder = placeholder; p.disabled = !!disabled;
    p.value = options.some(o => o.value === value) ? value : '';
    renderPickerTrigger(P, part);
  }


  function refreshDistricts(P, selected){
    const div = pickerValue(P, 'div');
    const list = div ? Object.keys(BD_GEO[div]).sort((a, b) => a.localeCompare(b)) : [];
    pickerSet(P, 'dist', toOpts(list), selected, div ? 'Select district' : 'Select division first', !div);
  }

  function refreshUpazilas(P, selected){
    const div = pickerValue(P, 'div'), dist = pickerValue(P, 'dist');
    const list = dist ? BD_GEO[div][dist] : [];
    const opts = dist ? toOpts(list).concat([{ value:OTHER, label:'Other (type it in)' }]) : [];
    pickerSet(P, 'upz', opts, selected, dist ? 'Select upazila' : 'Select district first', !dist);
    syncUpazilaOther(P);
  }

  function syncUpazilaOther(P){
    const open = pickerValue(P, 'upz') === OTHER;
    el(`f-${P}-upzother`).classList.toggle('open', open);
    if (!open) addrText(P, 'upzother').value = '';
  }

  function resetAddress(P){
    pickerSet(P, 'div', toOpts(Object.keys(BD_GEO).sort((a, b) => a.localeCompare(b))), ADDR_DEFAULT.division, 'Select division', false);
    refreshDistricts(P, ADDR_DEFAULT.district);
    refreshUpazilas(P, ADDR_DEFAULT.upazila);
    addrText(P, 'village').value = '';
    addrText(P, 'upzother').value = '';
    syncUpazilaOther(P);
  }


  function onPick(P, part, value){
    pickers[pKey(P, part)].value = value;
    renderPickerTrigger(P, part);
    fieldMsg(`f-${P}-${part}`, '');
    if (part === 'div'){
      // Rangpur is the default area, so choosing it again brings back the Rangpur defaults.
      const r = value === ADDR_DEFAULT.division;
      refreshDistricts(P, r ? ADDR_DEFAULT.district : '');
      refreshUpazilas(P, r ? ADDR_DEFAULT.upazila : '');
    } else if (part === 'dist'){
      const r = pickerValue(P, 'div') === ADDR_DEFAULT.division && value === ADDR_DEFAULT.district;
      refreshUpazilas(P, r ? ADDR_DEFAULT.upazila : '');
    } else {
      syncUpazilaOther(P);
      if (value === OTHER && !isTouch()) addrText(P, 'upzother').focus();
    }
  }


  function openPicker(P, part){
    const p = pickers[pKey(P, part)];
    const sub = part === 'dist' ? `in ${pickerValue(P,'div')} division`
              : part === 'upz'  ? `in ${pickerValue(P,'dist')} district` : '';
    openDrawer({
      title:'Select ' + PICKER_TITLES[part].toLowerCase(), subtitle:sub,
      options:p.options, value:p.value, trigger:el(`reg-${P}-${part}`),
      onSelect:v => onPick(P, part, v)
    });
  }


  function initAddress(P){
    el(P === 'present' ? 'addr-present' : 'addr-perm').innerHTML = addressBlockHTML(P);
    ['div','dist','upz'].forEach(part => {
      pickers[pKey(P, part)] = { options:[], value:'', placeholder:'', disabled:false };
      el(`reg-${P}-${part}`).addEventListener('click', () => openPicker(P, part));
    });
    resetAddress(P);
  }

  function readAddress(P){
    const upz = pickerValue(P, 'upz');
    return {
      division:pickerValue(P, 'div'), district:pickerValue(P, 'dist'),
      upazila: upz === OTHER ? addrText(P, 'upzother').value.trim() : upz,
      village: addrText(P, 'village').value.trim()
    };
  }

  /* ---------- Fees ---------- */
  // A package covers its included courses; those are shown as "Included" and not billed twice.

  function coveredCourses(){
    const map = {};
    regState.packages.forEach(pid => {
      const pkg = DEMO_PACKAGES.find(p => p.id === pid);
      pkg.includes.forEach(cid => { if (!map[cid]) map[cid] = pkg.name; });
    });
    return map;
  }


  function computeFees(){
    const covered = coveredCourses();
    const lines = [];
    let total = 0;
    DEMO_PACKAGES.forEach(p => {
      if (regState.packages.has(p.id)){ lines.push({ label:p.name, tag:'Package', amount:p.price }); total += p.price; }
    });
    DEMO_COURSES.forEach(c => {
      if (regState.courses.has(c.id) && !covered[c.id]){ lines.push({ label:c.name, amount:c.price }); total += c.price; }
    });
    return { lines, total };
  }


  function getPaid(){ return parseInt(el('reg-paid').value.replace(/\D/g, ''), 10) || 0; }


  function optionHTML(o){
    return `
      <label class="option" data-id="${o.id}">
        <input type="checkbox" data-kind="${o.kind}" value="${o.id}">
        <span class="option-body">
          <span class="option-name">${esc(o.name)}</span>
          <span class="option-meta">${esc(o.meta)}</span>
          ${o.extra || ''}
        </span>
        <span class="option-price">${money(o.price)}</span>
      </label>`;
  }


  function buildCourseLists(){
    el('reg-course-list').innerHTML = DEMO_COURSES.filter(c => c.status === 'active').map(c => optionHTML({ ...c, kind:'course' })).join('');
    el('reg-package-list').innerHTML = DEMO_PACKAGES.filter(p => p.status === 'active').map(p => {
      const separate = p.includes.reduce((sum, cid) => sum + courseById(cid).price, 0);
      const save = separate - p.price;
      return optionHTML({
        id:p.id, kind:'package', name:p.name, price:p.price,
        meta:'Includes ' + p.includes.map(cid => courseById(cid).name).join(', '),
        extra: save > 0 ? `<span class="option-save">Saves ${money(save)}</span>` : ''
      });
    }).join('');
  }

  // Called after Courses & Pricing changes something.

  function refreshCatalog(){
    DEMO_COURSES.forEach(c => { if (c.status !== 'active') regState.courses.delete(c.id); });
    DEMO_PACKAGES.forEach(p => { if (p.status !== 'active') regState.packages.delete(p.id); });
    if (el('reg-course-list')){ buildCourseLists(); syncOptions(); updateSummary(); }
  }


  function syncOptions(){
    const covered = coveredCourses();
    document.querySelectorAll('#reg-course-list .option').forEach(opt => {
      const id = opt.dataset.id, input = opt.querySelector('input'), via = covered[id];
      input.checked  = via ? true : regState.courses.has(id);
      input.disabled = !!via;
      opt.classList.toggle('is-covered', !!via);
      opt.classList.toggle('is-selected', !via && regState.courses.has(id));
      opt.querySelector('.option-meta').textContent = via ? 'Included in ' + via : courseById(id).meta;
    });
    document.querySelectorAll('#reg-package-list .option').forEach(opt => {
      const on = regState.packages.has(opt.dataset.id);
      opt.querySelector('input').checked = on;
      opt.classList.toggle('is-selected', on);
    });
  }


  function updateSummary(){
    const { lines, total } = computeFees();
    const paid = getPaid();
    const due  = Math.max(0, total - paid);
    const over = Math.max(0, paid - total);

    el('sum-empty').hidden = lines.length > 0;
    el('sum-lines').innerHTML = lines.map(l =>
      `<li class="sum-line"><span>${esc(l.label)}${l.tag ? `<span class="mini-tag">${l.tag}</span>` : ''}</span><span>${money(l.amount)}</span></li>`
    ).join('');
    el('sum-total').textContent = money(total);
    el('sum-due').textContent = money(due);
    el('sum-due-row').classList.toggle('is-clear', total > 0 && due === 0 && over === 0);

    let cls = 'pill-muted', text = 'No course selected';
    if (total > 0){
      if (over > 0){ cls = 'pill-danger'; text = 'Paid exceeds total'; }
      else if (paid === 0){ cls = 'pill-warning'; text = 'Unpaid'; }
      else if (due > 0){ cls = 'pill-warning'; text = 'Partially paid'; }
      else { cls = 'pill-success'; text = 'Paid in full'; }
    }
    const pill = el('sum-status');
    pill.className = 'pill ' + cls;
    pill.textContent = text;

    const hint = el('paid-hint');
    hint.classList.toggle('is-warn', over > 0);
    hint.textContent = over > 0
      ? `That's ${money(over)} more than the total. Due can't go below zero.`
      : 'Leave empty if nothing has been paid yet.';

    el('sum-pay-full').disabled = total === 0;
    el('mtb-total').textContent = money(total);
    el('mtb-due').textContent = money(due);
    updateMobileBar(total);
  }


  function updateMobileBar(total){
    if (total === undefined) total = computeFees().total;
    el('reg-mobile-bar').classList.toggle('is-off', summaryVisible || total === 0);
  }

  /* ---------- Validation ---------- */

  function fieldMsg(fieldId, msg){
    const f = el(fieldId);
    if (!f) return;
    f.classList.toggle('has-error', !!msg);
    const err = f.querySelector('.field-error');
    if (err) err.textContent = msg || '';
    const input = f.querySelector('input, textarea, .picker');
    if (input){
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (err){ err.id = 'err-' + input.id; input.setAttribute('aria-describedby', err.id); }
    }
  }

  // Each issue: { fieldId, inputId, label (what to fix), reason (short), msg (full sentence shown at the field) }

  function validateAddress(P, title, add){
    const a = readAddress(P);
    const f = part => [`f-${P}-${part}`, `reg-${P}-${part}`];
    if (!pickerValue(P,'div'))  add(...f('div'),  `${title}: Division`, 'not selected', 'Tap here and choose a division.');
    if (!pickerValue(P,'dist')) add(...f('dist'), `${title}: District`, 'not selected', 'Tap here and choose a district.');
    if (pickerValue(P,'upz') === OTHER){
      if (!a.upazila) add(...f('upzother'), `${title}: Upazila`, 'name not typed', 'Type the name of the upazila.');
    } else if (!pickerValue(P,'upz')){
      add(...f('upz'), `${title}: Upazila`, 'not selected', 'Tap here and choose an upazila.');
    }
    if (!a.village) add(...f('village'), `${title}: Village`, 'not filled in', 'Type the village name. This part is written by hand.');
  }


  function validateRegistration(){
    const issues = [];
    const v = id => el(id).value.trim();
    const add = (fieldId, inputId, label, reason, msg) => issues.push({ fieldId, inputId, label, reason, msg });

    if (v('reg-name').length < 2) add('f-name','reg-name',"Student's full name",'not filled in',"Type the student's full name.");
    if (!v('reg-father')) add('f-father','reg-father',"Father's name",'not filled in',"Type the father's name.");
    if (!v('reg-mother')) add('f-mother','reg-mother',"Mother's name",'not filled in',"Type the mother's name.");

    const mobile = cleanPhone(v('reg-mobile'));
    if (!mobile) add('f-mobile','reg-mobile','Mobile number','not filled in','Type the mobile number: 11 digits, like 01712345678.');
    else if (!BD_MOBILE.test(mobile)) add('f-mobile','reg-mobile','Mobile number','not a valid number',"This isn't a valid mobile number. Use 11 digits starting with 01, like 01712345678.");

    if (v('reg-email') && !EMAIL_RE.test(v('reg-email'))) add('f-email','reg-email','Email address','not a valid email','Check the email. It should look like name@example.com. You can also leave it empty.');

    if (el('reg-wa-diff').checked){
      const wa = cleanPhone(v('reg-wa'));
      if (!wa) add('f-wa','reg-wa','WhatsApp number','not filled in','Type the WhatsApp number, or untick the box above if it is the same as the mobile number.');
      else if (!BD_MOBILE.test(wa)) add('f-wa','reg-wa','WhatsApp number','not a valid number',"This isn't a valid number. Use 11 digits starting with 01, like 01712345678.");
    }

    validateAddress('present', 'Present address', add);
    if (!el('reg-same-addr').checked) validateAddress('perm', 'Permanent address', add);

    const { lines, total } = computeFees();
    if (lines.length === 0) issues.push({ fieldId:null, inputId:null, courses:true, label:'Courses', reason:'none chosen yet', msg:'' });
    if (total > 0 && getPaid() > total){
      add('f-paid','reg-paid','Amount paid','more than the total fees',
        `You entered ${money(getPaid())}, but the total fees are ${money(total)}. Enter ${money(total)} or less.`);
    }
    return issues;
  }


  function buildRegistrationPayload(){
    const v = id => el(id).value.trim();
    const { lines, total } = computeFees();
    const paid = getPaid();
    const mobile = cleanPhone(v('reg-mobile'));
    const covered = coveredCourses();
    const present = readAddress('present');
    return {
      student:{
        name:v('reg-name'), fatherName:v('reg-father'), motherName:v('reg-mother'),
        mobile,
        whatsapp: el('reg-wa-diff').checked ? cleanPhone(v('reg-wa')) : mobile,
        email:v('reg-email'),
        presentAddress:present,
        permanentAddress: el('reg-same-addr').checked ? { ...present } : readAddress('perm')
      },
      packageIds:[...regState.packages],
      courseIds:[...regState.courses].filter(id => !covered[id]),
      summary: lines.map(l => l.label).join(', '),
      totals:{ total, paid, due:Math.max(0, total - paid) },
      // PHASE 2 TODO: ignore this on the server; derive it from the session instead.
      registeredBy:{ id:currentUser.id, name:currentUser.name },
      createdAt:new Date().toISOString()
    };
  }


  function submitRegistration(payload){
    // PHASE 2 TODO: POST /api/registrations, return the saved record.
    return new Promise(resolve => setTimeout(() => {
      const seq = REG_SEQ_START + DEMO_REGISTRATIONS.length + 1;
      const record = { ...payload, id:`CL-${new Date().getFullYear()}-${String(seq).padStart(4,'0')}` };
      DEMO_REGISTRATIONS.unshift(record);
      resolve(record);
    }, 550));
  }


  function showFormError(issues){
    const n = issues.length;
    el('reg-error-title').textContent = n === 1
      ? "This student can't be registered yet. Fix this 1 item:"
      : `This student can't be registered yet. Fix these ${n} items:`;
    el('reg-error-hint').hidden = false;
    el('reg-error-list').innerHTML = issues.map(i => `
      <li><button type="button" class="err-link" data-field="${i.fieldId || ''}" data-input="${i.inputId || ''}">
        <strong>${esc(i.label)}</strong> — ${esc(i.reason)}
      </button></li>`).join('');
    el('reg-error').hidden = false;
  }


  function showGenericError(text){
    el('reg-error-title').textContent = text;
    el('reg-error-hint').hidden = true;
    el('reg-error-list').innerHTML = '';
    el('reg-error').hidden = false;
  }

  // Scroll a node to just under the sticky top bar. The browser's built-in smooth scrolling is ignored
  // in some embedded webviews (it made "Review" and the error-list jumps do nothing), so animate by
  // hand with scrollTo, then double-check and jump instantly if it did not land.

  function scrollToNode(node, offset = 80){
    const start = window.scrollY;
    const target = Math.max(0, node.getBoundingClientRect().top + start - offset);
    const finish = () => {
      if (Math.abs(node.getBoundingClientRect().top - offset) > 40) node.scrollIntoView({ block:'start', behavior:'auto' });   // e.g. a parent frame does the scrolling
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(target - start) < 4){ window.scrollTo(0, target); finish(); return; }
    const t0 = performance.now(), dur = Math.min(600, 200 + Math.abs(target - start) * 0.25);
    const step = now => {
      const t = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - t, 3);
      window.scrollTo(0, start + (target - start) * eased);
      if (t < 1) requestAnimationFrame(step); else finish();
    };
    requestAnimationFrame(step);
  }


  function goToField(fieldId, inputId){
    const target = fieldId ? el(fieldId) : el('reg-courses-card');
    scrollToNode(target);
    if (!fieldId) return;
    target.classList.add('flash');                      // brief pink pulse so the field is easy to spot
    setTimeout(() => target.classList.remove('flash'), 1500);
    if (!isTouch() && inputId) el(inputId).focus({ preventScroll:true });   // never pop the keyboard on phones
  }


  function clearErrors(){
    FIELD_IDS.forEach(id => fieldMsg(id, ''));
    el('reg-course-error').hidden = true;
    el('reg-courses-card').classList.remove('has-error');
  }

  async function handleRegistrationSubmit(e){
    e.preventDefault();
    el('reg-success').hidden = true;
    clearErrors();

    const issues = validateRegistration();
    if (issues.length){
      issues.forEach(i => {
        if (i.courses){
          el('reg-course-error').hidden = false;
          el('reg-courses-card').classList.add('has-error');
        } else fieldMsg(i.fieldId, i.msg);
      });
      showFormError(issues);
      // Take the person to the summary of what's wrong. Focusing a non-input never opens the keyboard.
      const box = el('reg-error');
      scrollToNode(box);
      box.focus({ preventScroll:true });
      return;
    }
    el('reg-error').hidden = true;

    const btn = el('reg-submit');
    btn.classList.add('is-loading'); btn.disabled = true;
    try {
      const record = await submitRegistration(buildRegistrationPayload());
      onRegistered(record);
    } catch (err){
      showGenericError("Something went wrong and the registration wasn't saved. Please try again.");
    } finally {
      btn.classList.remove('is-loading'); btn.disabled = false;
    }
  }


  function onRegistered(rec){
    el('reg-success-title').textContent = `${rec.student.name} is registered (${rec.id})`;
    el('reg-success-detail').textContent =
      `Total ${money(rec.totals.total)} · paid ${money(rec.totals.paid)} · due ${money(rec.totals.due)}`;
    resetRegistrationForm(true);
    el('reg-success').hidden = false;
    renderRecent();
    showToast('Registration saved');
    window.scrollTo({ top:0, behavior:scrollBehavior() });
  }


  function syncReveals(){
    el('f-wa').classList.toggle('open', el('reg-wa-diff').checked);
    el('addr-perm-wrap').classList.toggle('open', !el('reg-same-addr').checked);
  }


  function resetRegistrationForm(keepSuccess){
    el('reg-form').reset();
    ADDR_PREFIXES.forEach(resetAddress);   // form.reset() would blank the dropdowns, so refill the defaults
    regState.courses.clear();
    regState.packages.clear();
    clearErrors();
    el('reg-error').hidden = true;
    if (!keepSuccess) el('reg-success').hidden = true;
    syncReveals(); syncOptions(); updateSummary();
  }


  function initRegistrationForUser(user){
    el('by-name').textContent = user.name;
    el('by-avatar').textContent = initials(user.name);
    resetRegistrationForm(false);
    renderRecent();
  }


  function renderRecent(){
    persist();
    const rows = DEMO_REGISTRATIONS.slice(0, 5);
    el('reg-recent').hidden = rows.length === 0;
    el('reg-recent-list').innerHTML = rows.map(r => `
      <li class="recent-row">
        <div class="recent-main">
          <div class="recent-name">${esc(r.student.name)}</div>
          <div class="recent-meta">${esc(r.id)} · ${esc(r.summary)} · by ${esc(r.registeredBy.name)}</div>
        </div>
        <div class="recent-money">
          <div>${money(r.totals.paid)} paid</div>
          <div class="${r.totals.due ? 'is-due' : 'is-clear'}">${r.totals.due ? money(r.totals.due) + ' due' : 'Cleared'}</div>
        </div>
      </li>`).join('');
  }


  function initRegistration(){
    ADDR_PREFIXES.forEach(initAddress);
    buildCourseLists();
    syncOptions();
    updateSummary();

    el('reg-form').addEventListener('submit', handleRegistrationSubmit);

    const onOptionChange = e => {
      const input = e.target.closest('input[data-kind]');
      if (!input) return;
      const set = input.dataset.kind === 'package' ? regState.packages : regState.courses;
      if (input.checked) set.add(input.value); else set.delete(input.value);
      el('reg-course-error').hidden = true;
      el('reg-courses-card').classList.remove('has-error');
      syncOptions(); updateSummary();
    };
    el('reg-course-list').addEventListener('change', onOptionChange);
    el('reg-package-list').addEventListener('change', onOptionChange);

    el('reg-paid').addEventListener('input', function(){
      this.value = this.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
      updateSummary();
    });
    ['reg-mobile','reg-wa'].forEach(id => el(id).addEventListener('input', function(){
      this.value = this.value.replace(/[^\d+\s-]/g, '');
    }));
    el('sum-pay-full').addEventListener('click', () => {
      el('reg-paid').value = String(computeFees().total);
      fieldMsg('f-paid', '');
      updateSummary();
    });

    el('reg-wa-diff').addEventListener('change', () => {
      syncReveals();
      if (el('reg-wa-diff').checked){ if (!isTouch()) el('reg-wa').focus(); }
      else fieldMsg('f-wa', '');
    });
    el('reg-same-addr').addEventListener('change', () => {
      syncReveals();
      if (el('reg-same-addr').checked) ADDR_PARTS.forEach(part => fieldMsg(`f-perm-${part}`, ''));
    });

    // Clear a field's error as soon as the person edits it.
    const clearOnEdit = e => {
      const f = e.target.closest('.field');
      if (f && f.classList.contains('has-error')) fieldMsg(f.id, '');
    };
    el('reg-form').addEventListener('input', clearOnEdit);
    el('reg-form').addEventListener('change', clearOnEdit);

    // Tapping an item in the error summary jumps to that field.
    el('reg-error-list').addEventListener('click', e => {
      const btn = e.target.closest('.err-link');
      if (btn) goToField(btn.dataset.field, btn.dataset.input);
    });

    el('reg-success-close').addEventListener('click', () => { el('reg-success').hidden = true; });
    el('mtb-go').addEventListener('click', () => {
      const card = el('reg-summary');
      scrollToNode(card);
      card.classList.add('flash');                       // a brief ring, so it is obvious the button responded
      setTimeout(() => card.classList.remove('flash'), 1500);
    });

    if ('IntersectionObserver' in window){
      new IntersectionObserver(entries => {
        summaryVisible = entries[0].isIntersecting;
        updateMobileBar();
      }).observe(el('reg-summary'));
    }
  }

  /* ============================================================
     DRAWER (custom bottom-sheet picker; a centred dialog on desktop)
     Shared by the address fields. Usage:
       openDrawer({ title, subtitle, options:[{value,label}], value, trigger, onSelect })
     ============================================================ */
