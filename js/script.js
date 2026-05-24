/* ================================================================
   The Brew Timer — script.js v2.2.0
   ================================================================ */

const METHODS = [
  { id:"pourover", name:"Pour Over", ratio:15, temp:"93–96 °C", grind:"Medium-Fine", stages:[
    {label:"Bloom",duration:45,water:0.13,bloom:true},
    {label:"1st Pour",duration:60,water:0.30},
    {label:"2nd Pour",duration:60,water:0.30},
    {label:"Final Pour",duration:60,water:0.27}
  ]},
  { id:"frenchpress", name:"French Press", ratio:12, temp:"95–98 °C", grind:"Coarse", stages:[
    {label:"Bloom",duration:30,water:0.1,bloom:true},
    {label:"Add Remaining Water",duration:30,water:0.9},
    {label:"Steep",duration:210,water:0},
    {label:"Press & Pour",duration:30,water:0}
  ]},
  { id:"espresso", name:"Espresso", ratio:2, temp:"90–94 °C", grind:"Fine", stages:[
    {label:"Pre-infuse",duration:8,water:0.3},
    {label:"Extract",duration:22,water:0.7}
  ]},
  { id:"aeropress", name:"AeroPress", ratio:13, temp:"80–85 °C", grind:"Medium-Fine", stages:[
    {label:"Add Coffee",duration:10,water:0},
    {label:"Bloom",duration:30,water:0.15,bloom:true},
    {label:"Pour Remaining Water",duration:30,water:0.85},
    {label:"Stir & Steep",duration:60,water:0},
    {label:"Press",duration:20,water:0}
  ]},
  { id:"coldbrew", name:"Cold Brew", ratio:8, temp:"Room temp", grind:"Extra Coarse", stages:[
    {label:"Mix Coffee & Water",duration:60,water:1},
    {label:"Steep (12-24h)",duration:60,water:0},
    {label:"Filter & Serve",duration:30,water:0}
  ]}
];

// --- Audio ---
let audioCtx = null;
function beep(type){
  try{
    if (!audioCtx) {
      audioCtx = new(window.AudioContext||window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const ctx = audioCtx;
    const C={start:[[520,.12,0],[660,.14,.14]],stage:[[880,.1,0],[880,.1,.15],[1100,.15,.3]],warning:[[660,.08,0],[660,.08,.1]],done:[[523,.15,0],[659,.15,.18],[784,.25,.36]]};
    (C[type]||C.stage).forEach(([f,d,t])=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(0,ctx.currentTime+t);
      g.gain.linearRampToValueAtTime(.35,ctx.currentTime+t+.01);
      g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+t+d);
      o.start(ctx.currentTime+t);o.stop(ctx.currentTime+t+d+.05);
    });
  }catch(e){}
}

// --- Confetti ---
let confettiParticles = [];
function fireConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  confettiParticles = Array.from({length: 100}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    size: Math.random() * 8 + 4,
    speedX: Math.random() * 6 - 3,
    speedY: Math.random() * 5 + 2,
    color: ['#e8c99a','#c8823c','#7ecfa3','#6ba3d6'][Math.floor(Math.random()*4)],
    rot: Math.random() * 360,
    rotSpeed: Math.random() * 10 - 5
  }));
  
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;
    confettiParticles.forEach(p => {
      p.y += p.speedY; p.x += p.speedX; p.rot += p.rotSpeed;
      if (p.y < canvas.height) active = true;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      ctx.restore();
    });
    if(active) requestAnimationFrame(animate);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  animate();
}

// --- Toasts ---
function showToast(msg) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// --- Haptics ---
function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

// --- HTML Escaping Utility ---
function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

document.addEventListener('DOMContentLoaded', () => {
  // --- Init App ---
  setTimeout(() => {
    const splash = document.getElementById('splash');
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 500);
  }, 1500);

  // --- State ---
  let grams = 20, bloomOn = true, soundOn = true, countdown = false;
  let running = false, elapsed = 0, stageIdx = 0, stageElapsed = 0, done = false;
  let interval = null, prevStageIdx = -1, timerStartTime = 0;
  
  let history = JSON.parse(localStorage.getItem('brewHistory') || '[]');
  let favorites = JSON.parse(localStorage.getItem('brewFavs') || '[]');
  let beans = JSON.parse(localStorage.getItem('brewBeans') || '[]');
  let customRecipes = JSON.parse(localStorage.getItem('brewCustomRecipes') || '[]');
  
  let selectedBeanId = '';
  let activeTab = 'timer'; // timer, beans, recipes, journal
  
  // Set up active method
  let method = METHODS[0];
  let currentNoteRating = '';
  
  // Theme
  let theme = localStorage.getItem('theme') || 'dark';
  document.body.setAttribute('data-theme', theme);
  document.getElementById('theme-toggle').textContent = theme === 'dark' ? '🌙' : '☀️';

  // --- Elements ---
  const $ = id => document.getElementById(id);
  const pills = $('method-pills'), timerVal = $('timer-value');
  
  // --- Computed ---
  function fmt(s) { return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
  function activeMethod() { return method; }
  function hasBloom() { return activeMethod().stages.some(s=>s.bloom); }
  
  function allMethods() {
    return [...METHODS, ...customRecipes];
  }

  function activeStages() {
    const m = activeMethod();
    let stages = m.stages;
    
    // Override bloom stage duration dynamically based on selected bean age recommendations
    if (selectedBeanId && bloomOn) {
      const selectedBean = beans.find(b => b.id === selectedBeanId);
      if (selectedBean) {
        const rec = getSmartRecommendations(selectedBean);
        stages = stages.map(s => s.bloom ? { ...s, duration: rec.bloomDuration } : s);
      }
    }
    
    if (bloomOn || !hasBloom()) return stages;
    
    let carry = 0, r = [];
    for(const s of stages) {
      if(s.bloom) { carry += s.water; }
      else if(carry > 0 && s.water > 0) { r.push({...s, water: s.water + carry}); carry = 0; }
      else r.push(s);
    }
    return r;
  }
  
  function totalTime() { return activeStages().reduce((a,s)=>a+s.duration,0); }
  function water() { return grams * activeMethod().ratio; }

  // --- Number Animation Logic ---
  let currentWaterDisplay = water();
  let animReq = null;
  function animateWater(target) {
    if (currentWaterDisplay === target) {
      $('water-number').textContent = target;
      return;
    }
    const diff = target - currentWaterDisplay;
    const step = Math.ceil(Math.abs(diff) / 10) * Math.sign(diff);
    currentWaterDisplay += step;
    
    if ((step > 0 && currentWaterDisplay > target) || (step < 0 && currentWaterDisplay < target)) {
      currentWaterDisplay = target;
    }
    
    $('water-number').textContent = currentWaterDisplay;
    $('water-number').classList.add('rolling');
    
    if (currentWaterDisplay !== target) {
      animReq = requestAnimationFrame(() => animateWater(target));
    } else {
      setTimeout(() => $('water-number').classList.remove('rolling'), 200);
    }
  }

  // --- Smart Guide Recommendation Engine ---
  function getSmartRecommendations(bean) {
    const recs = {
      temp: "90–92 °C",
      grind: "Medium",
      bloomDuration: 40,
      description: ""
    };
    
    if (!bean) return recs;
    
    // Roast level mapping
    const roast = bean.roast.toLowerCase();
    if (roast.includes("light")) {
      recs.temp = "93–96 °C";
      recs.grind = "Medium-Fine";
    } else if (roast.includes("dark")) {
      recs.temp = "82–85 °C";
      recs.grind = "Medium-Coarse";
    } else {
      recs.temp = "89–92 °C";
      recs.grind = "Medium";
    }
    
    // Roast age mapping
    if (bean.roastDate && !isNaN(new Date(bean.roastDate).getTime())) {
      const ageDays = Math.round((Date.now() - new Date(bean.roastDate)) / (1000 * 60 * 60 * 24));
      if (ageDays <= 7) {
        recs.bloomDuration = 50; // Fresher, needs more degassing
        recs.description = `Very fresh (${ageDays}d). Extended bloom recommended.`;
      } else if (ageDays > 21) {
        recs.bloomDuration = 30; // Aged, requires less degassing
        recs.description = `Aged (${ageDays}d). Shorter bloom recommended.`;
      } else {
        recs.bloomDuration = 40;
        recs.description = `Perfect window (${ageDays}d). Standard bloom recommended.`;
      }
    } else {
      recs.bloomDuration = 45;
      recs.description = "Roast date unknown. Presetting moderate bloom.";
    }
    
    return recs;
  }

  // --- Render Functions ---
  function render(skipStagesReflow = false) {
    // 1. Render Tab bar state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === activeTab);
    });
    
    document.querySelectorAll('.view-section').forEach(section => {
      section.hidden = section.id !== `view-${activeTab}`;
    });

    if (activeTab === 'timer') {
      // Method pills
      pills.innerHTML = '';
      allMethods().forEach(m => {
        const b = document.createElement('button');
        b.className = 'method-pill' + (m.id===method.id ? ' active' : '');
        b.textContent = m.name;
        b.onclick = () => { method=m; reset(); render(); };
        pills.appendChild(b);
      });

      // Bloom
      if(!hasBloom()) $('bloom-section').hidden = true;
      else {
        $('bloom-section').hidden = false;
        $('bloom-toggle').className = 'bloom-toggle' + (bloomOn?' on':'');
        $('bloom-icon-box').textContent = bloomOn?'🌸':'🌾';
        
        // Grab custom or preset bloom stage
        const bloomStage = activeMethod().stages.find(s=>s.bloom);
        let bml = 0;
        if (bloomStage) {
          bml = Math.round(bloomStage.water * water());
        }
        $('bloom-desc').textContent = bloomOn ? `${bml}ml · degasses CO₂` : 'Skipped';
      }

      // Grams & Quick Dose
      $('gram-display').innerHTML = grams + '<span class="gram-unit">g</span>';
      $('gram-slider').value = grams;
      document.querySelectorAll('.dose-btn').forEach(btn => {
        btn.className = 'dose-btn' + (+btn.dataset.g === grams ? ' active' : '');
      });

      // Water needed
      const w = water(), m = activeMethod();
      if (animReq) cancelAnimationFrame(animReq);
      animateWater(w);
      $('ratio-display').textContent = `1:${m.ratio}`;
      
      // Smart Guide suggestions
      const selectedBean = beans.find(b => b.id === selectedBeanId);
      if (selectedBean) {
        const rec = getSmartRecommendations(selectedBean);
        $('tip-icon').textContent = '🤖';
        $('tip-text').innerHTML = `Smart tip: Brew at <strong>${rec.temp}</strong> · Grind: <strong>${rec.grind}</strong> · Bloom: <strong>${rec.bloomDuration}s</strong><br><small style="opacity:0.8">${rec.description}</small>`;
      } else {
        $('tip-icon').textContent = '🌡️';
        $('tip-text').innerHTML = `Temp: <strong>${m.temp||'—'}</strong> · Grind: <strong>${m.grind||'—'}</strong>`;
      }

      // Poured water status
      if(running) {
        $('poured-row').hidden = false;
        const st = activeStages(), cur = st[stageIdx];
        const wp = st.slice(0,stageIdx).reduce((a,s)=>a+s.water*w,0) + (cur?cur.water*w*(stageElapsed/cur.duration):0);
        $('poured-value').innerHTML = Math.round(wp) + '<span class="poured-ml">ml</span>';
      } else $('poured-row').hidden = true;

      // Timer Display
      const dispTime = countdown ? Math.max(0, totalTime() - elapsed) : elapsed;
      timerVal.textContent = done ? 'Done!' : fmt(dispTime);
      timerVal.className = 'timer-value' + (done ? ' done' : '');
      $('timer-sub').textContent = done ? 'Enjoy your brew' : `Total ${fmt(totalTime())}`;
      $('pulse-ring').className = 'pulse-ring' + (running ? ' active' : '');
      $('countdown-toggle').textContent = countdown ? '⏱ Count Down' : '⏱ Count Up';
      $('countdown-toggle').className = 'countdown-toggle' + (countdown ? ' active' : '');

      // Progress bars
      if(done) $('progress-area').style.display = 'none';
      else {
        $('progress-area').style.display = '';
        const st = activeStages(), cur = st[stageIdx];
        $('progress-stage').textContent = (running||elapsed>0) ? cur?.label : 'Ready to brew';
        $('progress-count').textContent = elapsed>0 ? `Stage ${stageIdx+1} / ${st.length}` : '';
        $('total-fill').style.width = (elapsed/totalTime()*100) + '%';
        $('stage-fill').style.width = cur ? (stageElapsed/cur.duration*100) + '%' : '0%';
      }

      // Stages list
      if (!skipStagesReflow) {
        const stList = $('stage-list');
        stList.innerHTML = '';
        let acc = 0;
        activeStages().forEach((s,i) => {
          const start = acc; acc += s.duration;
          const active = elapsed >= start && elapsed < acc && (running||elapsed>0);
          const complete = elapsed >= acc;
          const row = document.createElement('div');
          row.className = 'stage-row' + (active?' is-active':'') + (complete?' is-done':'');
          row.id = `stage-row-${i}`;
          let nameH = `<span class="stage-name">${s.label}`;
          if(s.bloom) nameH += `<span class="bloom-badge">bloom</span>`;
          nameH += '</span>';
          let met = fmt(s.duration);
          if(s.water > 0) met += `<span class="water-tag">${Math.round(s.water*w)}ml</span>`;
          row.innerHTML = `<div class="stage-dot">${complete?'✓':''}</div><div class="stage-info">${nameH}</div><div class="stage-meta">${met}</div>`;
          stList.appendChild(row);
        });
      } else {
        let acc = 0;
        activeStages().forEach((s,i) => {
          const start = acc; acc += s.duration;
          const active = elapsed >= start && elapsed < acc && (running||elapsed>0);
          const complete = elapsed >= acc;
          const row = $(`stage-row-${i}`);
          if(row) row.className = 'stage-row' + (active?' is-active':'') + (complete?' is-done':'');
          if(row) {
            const dot = row.querySelector('.stage-dot');
            dot.textContent = complete ? '✓' : '';
          }
        });
      }

      // Update Beans Select
      const beanSelect = $('bean-select');
      const curSel = selectedBeanId;
      beanSelect.innerHTML = '<option value="">Generic / No Specific Bean</option>';
      const activeBeans = beans.filter(b => !b.finished);
      activeBeans.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${b.roaster} - ${b.name} (${b.weight}g left)`;
        if (b.id === curSel) opt.selected = true;
        beanSelect.appendChild(opt);
      });
      
      const activeSelected = activeBeans.find(b => b.id === curSel);
      if (!activeSelected) {
        selectedBeanId = '';
        beanSelect.value = '';
      } else {
        selectedBeanId = curSel;
        beanSelect.value = curSel;
      }

      const currentBean = beans.find(b => b.id === selectedBeanId);
      if (currentBean) {
        $('beans-status').textContent = `(${currentBean.weight}g left)`;
        if (grams > currentBean.weight) {
          $('bean-warning').hidden = false;
          $('bean-warning').textContent = `⚠️ Warning: Only ${currentBean.weight}g left in this bag!`;
        } else {
          $('bean-warning').hidden = true;
        }
      } else {
        $('beans-status').textContent = '';
        $('bean-warning').hidden = true;
      }

      // Start button state
      $('btn-start').textContent = done ? 'Complete' : running ? 'Pause' : elapsed>0 ? 'Resume' : 'Start';
      $('btn-start').className = 'btn-start' + (done?' is-done':'');
      $('btn-sound').textContent = soundOn ? '🔔' : '🔕';
      $('btn-sound').className = 'btn-icon' + (soundOn?'':' muted');
    }

    if (activeTab === 'beans') {
      renderBeansList();
    }

    if (activeTab === 'recipes') {
      renderFavoritesList();
      renderCustomRecipesList();
    }

    if (activeTab === 'journal') {
      calculateAnalytics();
      renderHistoryList();
    }
  }

  // --- Engine ---
  function tick() {
    if (!running) return;
    const currentElapsed = Math.floor((Date.now() - timerStartTime) / 1000);
    if (currentElapsed === elapsed) return;
    
    elapsed = currentElapsed;
    if(elapsed >= totalTime()) {
      elapsed = totalTime();
      clearInterval(interval); running = false; done = true;
      if(soundOn) beep('done');
      vibrate(500);
      fireConfetti();
      $('brew-notes-card').hidden = false;
      render(true); return;
    }
    
    let acc=0, idx=0, se=0;
    const st = activeStages();
    for(let i=0; i<st.length; i++) {
      acc += st[i].duration;
      if(elapsed < acc) { idx = i; se = elapsed - (acc - st[i].duration); break; }
    }
    
    if(idx !== prevStageIdx) {
      prevStageIdx = idx;
      if(soundOn) beep('stage');
      vibrate(100);
      showToast(`${st[idx].label} — ${Math.round(st[idx].water*water())}ml`);
    }
    if(st[idx].duration - se === 3 && soundOn) beep('warning');
    
    stageIdx = idx; stageElapsed = se;
    render(true);
  }
  
  function reset() {
    clearInterval(interval); running = false; elapsed = 0; stageIdx = 0; stageElapsed = 0; done = false; prevStageIdx = -1; timerStartTime = 0;
    $('brew-notes-card').hidden = true;
    currentNoteRating = '';
    $('notes-text').value = '';
    document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('active'));
  }

  // --- Tab Switch Events ---
  document.querySelectorAll('.nav-item').forEach(item => {
    item.onclick = () => {
      activeTab = item.dataset.view;
      render();
    };
  });

  // --- Theme Toggle ---
  $('theme-toggle').onclick = () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', theme);
    $('theme-toggle').textContent = theme === 'dark' ? '🌙' : '☀️';
    localStorage.setItem('theme', theme);
    render();
  };

  // --- Timer Events ---
  $('countdown-toggle').onclick = () => { countdown = !countdown; render(true); };
  
  $('gram-dec').onclick = () => { grams = Math.max(5, grams-1); reset(); render(); };
  $('ratio-dec').onclick = () => { method.ratio = Math.max(1, method.ratio - 1); reset(); render(); };
  $('ratio-inc').onclick = () => { method.ratio = Math.min(50, method.ratio + 1); reset(); render(); };
  $('gram-inc').onclick = () => { grams = Math.min(100, grams+1); reset(); render(); };
  $('gram-slider').oninput = () => { grams = +$('gram-slider').value; reset(); render(); };
  
  document.querySelectorAll('.dose-btn').forEach(btn => {
    btn.onclick = () => { grams = +btn.dataset.g; reset(); render(); };
  });

  $('bloom-toggle').onclick = () => { bloomOn = !bloomOn; reset(); render(); };
  $('btn-sound').onclick = () => { soundOn = !soundOn; render(true); };
  $('btn-reset').onclick = () => { reset(); render(); };
  
  $('btn-start').onclick = () => {
    if(done) return;
    if(!running) {
      if(elapsed === 0 && soundOn) beep('start');
      timerStartTime = Date.now() - elapsed * 1000;
      running = true; interval = setInterval(tick, 200);
    } else { clearInterval(interval); running = false; }
    render(true);
  };

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if(document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT') return;
    // Only allow hotkeys on the main timer tab
    if (activeTab !== 'timer') return;
    if(e.code === 'Space') { e.preventDefault(); $('btn-start').click(); }
    if(e.code === 'KeyR') { $('btn-reset').click(); }
  });

  // Bean Selector dropdown onchange
  $('bean-select').onchange = (e) => {
    selectedBeanId = e.target.value;
    render(true);
  };

  // --- Brew Notes & History saving ---
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentNoteRating = btn.dataset.r;
    };
  });
  
  $('btn-save-note').onclick = () => {
    let savedBeanName = null;
    if (selectedBeanId) {
      const bean = beans.find(b => b.id === selectedBeanId);
      if (bean) {
        bean.weight = Math.max(0, bean.weight - grams);
        savedBeanName = `${bean.roaster} - ${bean.name}`;
        if (bean.weight <= 0) {
          bean.finished = true;
          showToast(`Finished your bag of ${bean.name}!`);
        } else {
          showToast(`Deducted ${grams}g from ${bean.name} (${bean.weight}g left)`);
        }
        localStorage.setItem('brewBeans', JSON.stringify(beans));
      }
    }
    const entry = {
      date: new Date().toISOString(),
      method: activeMethod().name,
      grams: grams,
      water: water(),
      ratio: activeMethod().ratio,
      rating: currentNoteRating,
      note: $('notes-text').value,
      beanId: selectedBeanId || null,
      beanName: savedBeanName
    };
    history.unshift(entry);
    localStorage.setItem('brewHistory', JSON.stringify(history));
    $('brew-notes-card').hidden = true;
    if (!savedBeanName) {
      showToast('Saved to history!');
    }
    reset();
    activeTab = 'journal'; // Jump to journal to see stats & logs updated!
    render();
  };
  
  $('btn-skip-note').onclick = () => {
    $('brew-notes-card').hidden = true;
    reset();
    render();
  };

  // --- Beans Tab Management ---
  $('btn-add-bean-show').onclick = () => {
    $('bean-form-title').textContent = 'Add Coffee Bean';
    $('form-bean-id').value = '';
    $('bean-form').reset();
    $('input-roast-date').value = new Date().toISOString().split('T')[0];
    $('input-bag-size').value = 250;
    $('input-weight').value = 250;
    
    $('beans-list-view').hidden = true;
    $('bean-form-view').hidden = false;
  };
  
  $('btn-cancel-bean').onclick = () => {
    $('bean-form-view').hidden = true;
    $('beans-list-view').hidden = false;
  };
  
  $('btn-save-bean').onclick = () => {
    const roaster = $('input-roaster').value.trim();
    const name = $('input-name').value.trim();
    const origin = $('input-origin').value.trim();
    const roast = $('input-roast').value;
    const roastDate = $('input-roast-date').value;
    const bagSize = parseInt($('input-bag-size').value) || 250;
    const weight = parseInt($('input-weight').value) || 0;
    const notes = $('input-notes').value.trim();
    const id = $('form-bean-id').value;
    
    if (!roaster || !name) {
      showToast('Please fill out Roaster and Bean Name!');
      return;
    }
    
    if (id) {
      const b = beans.find(x => x.id === id);
      if (b) {
        b.roaster = roaster;
        b.name = name;
        b.origin = origin;
        b.roast = roast;
        b.roastDate = roastDate;
        b.bagSize = bagSize;
        b.weight = weight;
        b.notes = notes;
        showToast('Bean details updated!');
      }
    } else {
      const newBean = {
        id: 'bean_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        roaster, name, origin, roast, roastDate, bagSize, weight, notes,
        finished: false
      };
      beans.push(newBean);
      showToast('New coffee bag registered!');
    }
    
    localStorage.setItem('brewBeans', JSON.stringify(beans));
    $('bean-form-view').hidden = true;
    $('beans-list-view').hidden = false;
    render();
  };

  function renderBeansList() {
    const list = $('beans-list');
    list.innerHTML = '';
    
    if (beans.length === 0) {
      list.innerHTML = '<p class="empty-state">No coffee beans added yet. Start by adding a bag!</p>';
      return;
    }
    
    const sorted = [...beans].sort((x, y) => {
      if (x.finished === y.finished) return y.id.localeCompare(x.id);
      return x.finished ? 1 : -1;
    });
    
    sorted.forEach(b => {
      const card = document.createElement('div');
      card.className = 'bean-card' + (b.finished ? ' finished' : '');
      
      const pct = Math.min(100, Math.max(0, Math.round((b.weight / b.bagSize) * 100)));
      
      let badgeClass = 'roast-medium';
      if (b.roast.toLowerCase().includes('light')) badgeClass = 'roast-light';
      else if (b.roast.toLowerCase().includes('dark')) badgeClass = 'roast-dark';
      
      let details = [];
      if (b.origin) details.push(escapeHTML(b.origin));
      if (b.roastDate) {
        const age = Math.round((Date.now() - new Date(b.roastDate)) / (1000 * 60 * 60 * 24));
        const ageText = age === 0 ? 'today' : age === 1 ? 'yesterday' : `${age} days ago`;
        details.push(`Roasted ${escapeHTML(b.roastDate)} (${ageText})`);
      }
      
      card.innerHTML = `
        <div class="bean-card-header">
          <div class="bean-card-title-group">
            <span class="bean-card-roaster">${escapeHTML(b.roaster)}</span>
            <span class="bean-card-title">${escapeHTML(b.name)}</span>
          </div>
          <span class="bean-card-badge ${badgeClass}">${escapeHTML(b.roast)}</span>
        </div>
        
        ${details.length > 0 ? `<div class="bean-card-meta">${details.join(' · ')}</div>` : ''}
        ${b.notes ? `<div class="bean-card-notes">“${escapeHTML(b.notes)}”</div>` : ''}
        
        <div class="bean-card-progress">
          <div class="bean-card-progress-text">
            <span>Remaining</span>
            <span>${b.weight}g / ${b.bagSize}g (${pct}%)</span>
          </div>
          <div class="bean-progress-track">
            <div class="bean-progress-fill" style="width: ${pct}%"></div>
          </div>
        </div>
        
        <div class="bean-card-actions">
          ${!b.finished ? `<button class="log-btn" style="color:var(--green)" onclick="window.useBean('${b.id}')">Select</button>` : ''}
          <button class="log-btn" onclick="window.editBean('${b.id}')">Edit</button>
          <button class="log-btn" onclick="window.toggleArchiveBean('${b.id}')">${b.finished ? 'Reopen' : 'Archive'}</button>
          <button class="log-btn" style="color:var(--red)" onclick="window.deleteBean('${b.id}')">✕</button>
        </div>
      `;
      
      list.appendChild(card);
    });
  }

  window.useBean = (id) => {
    selectedBeanId = id;
    activeTab = 'timer';
    render();
    showToast('Coffee bean selected!');
  };
  
  window.editBean = (id) => {
    const b = beans.find(x => x.id === id);
    if (b) {
      $('bean-form-title').textContent = 'Edit Coffee Bean';
      $('form-bean-id').value = b.id;
      $('input-roaster').value = b.roaster;
      $('input-name').value = b.name;
      $('input-origin').value = b.origin || '';
      $('input-roast').value = b.roast;
      $('input-roast-date').value = b.roastDate || '';
      $('input-bag-size').value = b.bagSize;
      $('input-weight').value = b.weight;
      $('input-notes').value = b.notes || '';
      
      $('beans-list-view').hidden = true;
      $('bean-form-view').hidden = false;
    }
  };
  
  window.toggleArchiveBean = (id) => {
    const b = beans.find(x => x.id === id);
    if (b) {
      b.finished = !b.finished;
      if (b.finished && selectedBeanId === id) {
        selectedBeanId = '';
      }
      localStorage.setItem('brewBeans', JSON.stringify(beans));
      showToast(b.finished ? 'Coffee bag archived!' : 'Coffee bag restored!');
      render();
    }
  };
  
  window.deleteBean = (id) => {
    if (confirm("Delete this coffee bag? This cannot be undone.")) {
      const idx = beans.findIndex(x => x.id === id);
      if (idx !== -1) {
        beans.splice(idx, 1);
        if (selectedBeanId === id) selectedBeanId = '';
        localStorage.setItem('brewBeans', JSON.stringify(beans));
        showToast('Coffee bag deleted!');
        render();
      }
    }
  };

  // --- Recipes & Custom Recipe Builder tab management ---
  function renderFavoritesList() {
    const b = $('favorites-body');
    if(favorites.length === 0) b.innerHTML = '<p class="empty-state">No favorites saved yet.</p>';
    else {
      b.innerHTML = favorites.map((f, i) => `
        <div class="log-item">
          <div>
            <div class="log-title">${escapeHTML(f.name)}</div>
            <div class="log-sub">${escapeHTML(allMethods().find(m=>m.id===f.method)?.name || 'Custom')} · ${f.grams}g</div>
          </div>
          <div class="log-actions">
            <button class="log-btn" onclick="window.loadFav(${i})">Load</button>
            <button class="log-btn" style="color:var(--red)" onclick="window.delFav(${i})">✕</button>
          </div>
        </div>
      `).join('');
    }
  }

  window.loadFav = (i) => {
    const f = favorites[i];
    method = allMethods().find(m=>m.id===f.method) || METHODS[0];
    grams = f.grams;
    activeTab = 'timer';
    reset(); render(); showToast('Loaded recipe!');
  };
  
  window.delFav = (i) => {
    favorites.splice(i, 1);
    localStorage.setItem('brewFavs', JSON.stringify(favorites));
    render();
  };

  const btnSaveFav = $('btn-save-fav');
  if (btnSaveFav) {
    btnSaveFav.onclick = () => {
      const name = prompt("Name this recipe:");
      if(name) {
        favorites.push({ 
          name, 
          method: activeMethod().id, 
          grams 
        });
        localStorage.setItem('brewFavs', JSON.stringify(favorites));
        render();
        showToast('Recipe saved to Favorites!');
      }
    };
  }

  // --- Custom Recipes list and creation ---
  function renderCustomRecipesList() {
    const list = $('custom-recipes-list');
    if(customRecipes.length === 0) {
      list.innerHTML = '<p class="empty-state">No custom recipes created yet.</p>';
    } else {
      list.innerHTML = customRecipes.map(r => `
        <div class="log-item">
          <div>
            <div class="log-title">${escapeHTML(r.name)}</div>
            <div class="log-sub">${r.stages.length} stages · Ratio 1:${r.ratio} · Temp ${escapeHTML(r.temp)}</div>
          </div>
          <div class="log-actions">
            <button class="log-btn" onclick="window.loadCustomRecipe('${r.id}')">Load</button>
            <button class="log-btn" onclick="window.editCustomRecipe('${r.id}')">Edit</button>
            <button class="log-btn" style="color:var(--red)" onclick="window.deleteCustomRecipe('${r.id}')">✕</button>
          </div>
        </div>
      `).join('');
    }
  }

  // Dynamic stages form builder row markup helper
  function addStageRow(label = '', duration = 30, waterPct = 20, isBloom = false) {
    const container = $('recipe-stages-container');
    const div = document.createElement('div');
    div.className = 'recipe-stage-row';
    div.innerHTML = `
      <input type="text" class="stage-lbl" placeholder="Stage Label (e.g. Pour)" value="${label}" required>
      <input type="number" class="stage-dur" placeholder="Seconds" value="${duration}" min="1" required>
      <input type="number" class="stage-water" placeholder="Water %" value="${waterPct}" min="0" max="100" required>
      <div class="bloom-chk-wrapper">
        <label>Bloom</label>
        <input type="checkbox" class="stage-bloom" ${isBloom?'checked':''}>
      </div>
      <button type="button" class="btn-stage-delete" onclick="this.parentElement.remove(); window.recalcRecipeWaterTotal();">✕</button>
    `;
    // Add event listener to update total water % dynamically on input change
    div.querySelectorAll('input').forEach(input => {
      input.oninput = () => window.recalcRecipeWaterTotal();
      input.onchange = () => window.recalcRecipeWaterTotal();
    });
    container.appendChild(div);
    window.recalcRecipeWaterTotal();
  }

  window.recalcRecipeWaterTotal = () => {
    let total = 0;
    document.querySelectorAll('.recipe-stage-row').forEach(row => {
      total += parseInt(row.querySelector('.stage-water').value) || 0;
    });
    const label = $('stages-total-pct');
    label.textContent = `Total: ${total}%`;
    label.classList.toggle('invalid', total !== 100);
  };

  $('btn-add-recipe-show').onclick = () => {
    $('recipe-form-title').textContent = 'Create Custom Recipe';
    $('form-recipe-id').value = '';
    $('recipe-form').reset();
    $('recipe-stages-container').innerHTML = '';
    
    // Seed with two default rows: Bloom (40s, 15%) and Pour (60s, 85%)
    addStageRow('Bloom', 40, 15, true);
    addStageRow('Main Pour', 60, 85, false);
    
    $('recipes-list-view').hidden = true;
    $('recipe-form-view').hidden = false;
  };

  $('btn-recipe-add-stage').onclick = () => {
    addStageRow('Pour', 45, 20, false);
  };

  $('btn-cancel-recipe').onclick = () => {
    $('recipe-form-view').hidden = true;
    $('recipes-list-view').hidden = false;
  };

  $('btn-save-recipe').onclick = () => {
    const name = $('recipe-input-name').value.trim();
    const ratio = parseInt($('recipe-input-ratio').value) || 15;
    const temp = $('recipe-input-temp').value.trim() || '92 °C';
    const grind = $('recipe-input-grind').value.trim() || 'Medium';
    const id = $('form-recipe-id').value;

    if (!name) {
      showToast('Please specify a recipe name!');
      return;
    }

    // Read stages
    const rows = document.querySelectorAll('.recipe-stage-row');
    if (rows.length === 0) {
      showToast('Please add at least one stage!');
      return;
    }

    let totalPct = 0;
    const stages = [];
    let isValid = true;
    
    rows.forEach(row => {
      const label = row.querySelector('.stage-lbl').value.trim();
      const duration = parseInt(row.querySelector('.stage-dur').value) || 0;
      const waterPct = parseInt(row.querySelector('.stage-water').value) || 0;
      const isBloom = row.querySelector('.stage-bloom').checked;
      
      if (!label || duration <= 0) isValid = false;
      totalPct += waterPct;
      
      stages.push({
        label,
        duration,
        water: waterPct / 100, // converted back to fraction
        bloom: isBloom
      });
    });

    if (!isValid) {
      showToast('Please ensure all stages have labels and positive durations!');
      return;
    }

    if (totalPct !== 100) {
      showToast(`Water percentages must sum to 100%! Current sum: ${totalPct}%`);
      return;
    }

    if (id) {
      const r = customRecipes.find(x => x.id === id);
      if (r) {
        r.name = name;
        r.ratio = ratio;
        r.temp = temp;
        r.grind = grind;
        r.stages = stages;
        showToast('Custom recipe updated!');
      }
    } else {
      const newRecipe = {
        id: 'recipe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        name, ratio, temp, grind, stages
      };
      customRecipes.push(newRecipe);
      showToast('Custom recipe created!');
    }

    localStorage.setItem('brewCustomRecipes', JSON.stringify(customRecipes));
    $('recipe-form-view').hidden = true;
    $('recipes-list-view').hidden = false;
    render();
  };

  window.loadCustomRecipe = (id) => {
    const r = customRecipes.find(x => x.id === id);
    if (r) {
      method = r;
      activeTab = 'timer';
      reset();
      render();
      showToast(`Loaded ${r.name}!`);
    }
  };

  window.editCustomRecipe = (id) => {
    const r = customRecipes.find(x => x.id === id);
    if (r) {
      $('recipe-form-title').textContent = 'Edit Custom Recipe';
      $('form-recipe-id').value = r.id;
      $('recipe-input-name').value = r.name;
      $('recipe-input-ratio').value = r.ratio;
      $('recipe-input-temp').value = r.temp;
      $('recipe-input-grind').value = r.grind;
      
      $('recipe-stages-container').innerHTML = '';
      r.stages.forEach(s => {
        addStageRow(s.label, s.duration, Math.round(s.water * 100), s.bloom);
      });
      
      $('recipes-list-view').hidden = true;
      $('recipe-form-view').hidden = false;
    }
  };

  window.deleteCustomRecipe = (id) => {
    if (confirm("Delete this custom recipe?")) {
      const idx = customRecipes.findIndex(x => x.id === id);
      if (idx !== -1) {
        customRecipes.splice(idx, 1);
        if (method.id === id) {
          method = METHODS[0]; // Reset to Pourover preset if loaded method is deleted
        }
        localStorage.setItem('brewCustomRecipes', JSON.stringify(customRecipes));
        showToast('Custom recipe deleted!');
        render();
      }
    }
  };

  // --- Advanced Stats & History Journal tab management ---
  function calculateAnalytics() {
    const totalBrews = history.length;
    let totalGrams = 0;
    let totalWaterMl = 0;
    let ratingSum = 0;
    let ratedBrewsCount = 0;
    
    const methodCounts = {};
    const ratingCounts = { sour: 0, balanced: 0, bitter: 0, unrated: 0 };

    history.forEach(h => {
      totalGrams += h.grams || 0;
      totalWaterMl += h.water || (h.grams * h.ratio) || 0;
      
      // Calculate rating scores
      if (h.rating) {
        ratedBrewsCount++;
        if (h.rating === 'balanced') {
          ratingSum += 5.0;
          ratingCounts.balanced++;
        } else if (h.rating === 'bitter') {
          ratingSum += 3.0;
          ratingCounts.bitter++;
        } else if (h.rating === 'sour') {
          ratingSum += 2.0;
          ratingCounts.sour++;
        }
      } else {
        ratingCounts.unrated++;
      }

      // Group by method
      const mName = h.method || 'Unknown';
      methodCounts[mName] = (methodCounts[mName] || 0) + 1;
    });

    const avgRating = ratedBrewsCount > 0 ? (ratingSum / ratedBrewsCount).toFixed(1) : '0.0';

    // Update Counter cards
    $('stat-total-brews').textContent = totalBrews;
    $('stat-total-coffee').innerHTML = totalGrams + '<span class="stat-unit">g</span>';
    $('stat-total-water').innerHTML = (totalWaterMl / 1000).toFixed(1) + '<span class="stat-unit">L</span>';
    $('stat-avg-rating').textContent = avgRating;

    // 1. Render Brews by Method CSS Chart
    const methodsGroup = $('chart-methods');
    methodsGroup.innerHTML = '';
    
    const mEntries = Object.entries(methodCounts);
    if (mEntries.length === 0) {
      methodsGroup.innerHTML = '<span style="font-size:10px; color:var(--gold-45)">No data</span>';
    } else {
      const maxCount = Math.max(...mEntries.map(e => e[1]));
      mEntries.sort((a,b) => b[1] - a[1]).slice(0, 3).forEach(([methodName, count]) => {
        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
        const wrap = document.createElement('div');
        wrap.className = 'chart-bar-wrap';
        wrap.innerHTML = `
          <div class="chart-bar" style="height: ${pct}%" data-count="${count} brews"></div>
          <span class="chart-bar-label">${methodName}</span>
        `;
        methodsGroup.appendChild(wrap);
      });
    }

    // 2. Render Brews by Rating CSS Chart
    const ratingsGroup = $('chart-ratings');
    ratingsGroup.innerHTML = '';
    
    const rEntries = [
      ['Balanced', ratingCounts.balanced, '😊'],
      ['Bitter', ratingCounts.bitter, '😣'],
      ['Sour', ratingCounts.sour, '😖']
    ];
    
    const maxRatingCount = Math.max(...rEntries.map(e => e[1]));
    if (maxRatingCount === 0) {
      ratingsGroup.innerHTML = '<span style="font-size:10px; color:var(--gold-45)">No data</span>';
    } else {
      rEntries.forEach(([label, count, emoji]) => {
        const pct = maxRatingCount > 0 ? (count / maxRatingCount) * 100 : 0;
        const wrap = document.createElement('div');
        wrap.className = 'chart-bar-wrap';
        wrap.innerHTML = `
          <div class="chart-bar" style="height: ${pct}%" data-count="${count} brews"></div>
          <span class="chart-bar-label">${emoji} ${label}</span>
        `;
        ratingsGroup.appendChild(wrap);
      });
    }
  }

  function renderHistoryList() {
    const b = $('history-body');
    const clearBtn = $('btn-clear-history');
    if(history.length === 0) {
      b.innerHTML = '<p class="empty-state">No brews logged yet.</p>';
      clearBtn.style.display = 'none';
    } else {
      clearBtn.style.display = 'block';
      b.innerHTML = history.map(h => `
        <div class="log-item">
          <div>
            <div class="log-title">${escapeHTML(h.method)} — ${h.grams}g</div>
            <div class="log-sub">${new Date(h.date).toLocaleDateString()} · 1:${h.ratio}</div>
            ${h.beanName ? `<div class="log-sub" style="font-weight:700; color:var(--amber)">🫘 ${escapeHTML(h.beanName)}</div>` : ''}
            ${h.note ? `<div class="log-sub" style="font-style:italic">"${escapeHTML(h.note)}"</div>` : ''}
          </div>
          <div class="log-rating">${h.rating==='sour'?'😖':h.rating==='balanced'?'😊':h.rating==='bitter'?'😣':'☕'}</div>
        </div>
      `).join('');
    }
  }

  $('btn-clear-history').onclick = () => {
    if (confirm("Clear all brew history? This cannot be undone.")) {
      history = [];
      localStorage.setItem('brewHistory', '[]');
      render();
    }
  };

  // Initial render
  render();
});

// --- Register Service Worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered!', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}
