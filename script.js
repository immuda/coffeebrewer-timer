/* ================================================================
   The Brew Timer — script.js v2.0.2
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
function beep(type){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
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

document.addEventListener('DOMContentLoaded', () => {
  // --- Init App ---
  setTimeout(() => {
    const splash = document.getElementById('splash');
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 500);
  }, 1500);

  // --- State ---
  let grams = 20, method = METHODS[0], bloomOn = true, soundOn = true, countdown = false;
  let running = false, elapsed = 0, stageIdx = 0, stageElapsed = 0, done = false;
  let interval = null, prevStageIdx = -1;
  let history = JSON.parse(localStorage.getItem('brewHistory') || '[]');
  let favorites = JSON.parse(localStorage.getItem('brewFavs') || '[]');
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
  function activeStages() {
    const m = activeMethod();
    if(bloomOn || !hasBloom()) return m.stages;
    let carry = 0, r = [];
    for(const s of m.stages) {
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
    
    // Check if overshot
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

  // --- Render ---
  function render(skipStagesReflow = false) {
    // Method pills
    pills.innerHTML = '';
    METHODS.forEach(m => {
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
      const bml = Math.round((activeMethod().stages.find(s=>s.bloom)?.water||0)*water());
      $('bloom-desc').textContent = bloomOn ? `${bml}ml · degasses CO₂` : 'Skipped';
    }

    // Grams & Quick Dose
    $('gram-display').innerHTML = grams + '<span class="gram-unit">g</span>';
    $('gram-slider').value = grams;
    document.querySelectorAll('.dose-btn').forEach(btn => {
      btn.className = 'dose-btn' + (+btn.dataset.g === grams ? ' active' : '');
    });

    // Water & Tips
    const w = water(), m = activeMethod();
    if (animReq) cancelAnimationFrame(animReq);
    animateWater(w);
    $('ratio-display').textContent = `1:${m.ratio}`;
    $('tip-text').innerHTML = `Temp: <strong>${m.temp||'—'}</strong> · Grind: <strong>${m.grind||'—'}</strong>`;

    if(running) {
      $('poured-row').hidden = false;
      const st = activeStages(), cur = st[stageIdx];
      const wp = st.slice(0,stageIdx).reduce((a,s)=>a+s.water*w,0) + (cur?cur.water*w*(stageElapsed/cur.duration):0);
      $('poured-value').innerHTML = Math.round(wp) + '<span class="poured-ml">ml</span>';
    } else $('poured-row').hidden = true;

    // Timer
    const dispTime = countdown ? Math.max(0, totalTime() - elapsed) : elapsed;
    timerVal.textContent = done ? 'Done!' : fmt(dispTime);
    timerVal.className = 'timer-value' + (done ? ' done' : '');
    $('timer-sub').textContent = done ? 'Enjoy your brew' : `Total ${fmt(totalTime())}`;
    $('pulse-ring').className = 'pulse-ring' + (running ? ' active' : '');
    $('countdown-toggle').textContent = countdown ? '⏱ Count Down' : '⏱ Count Up';
    $('countdown-toggle').className = 'countdown-toggle' + (countdown ? ' active' : '');

    // Progress
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
      // Just update classes
      let acc = 0;
      activeStages().forEach((s,i) => {
        const start = acc; acc += s.duration;
        const active = elapsed >= start && elapsed < acc && (running||elapsed>0);
        const complete = elapsed >= acc;
        const row = $(`stage-row-${i}`);
        if(row) row.className = 'stage-row' + (active?' is-active':'') + (complete?' is-done':'');
        // also update dot color
        if(row) {
          const dot = row.querySelector('.stage-dot');
          dot.textContent = complete ? '✓' : '';
        }
      });
    }

    // Controls
    $('btn-start').textContent = done ? 'Complete' : running ? 'Pause' : elapsed>0 ? 'Resume' : 'Start';
    $('btn-start').className = 'btn-start' + (done?' is-done':'');
    $('btn-sound').textContent = soundOn ? '🔔' : '🔕';
    $('btn-sound').className = 'btn-icon' + (soundOn?'':' muted');

    // Modals
    renderHistory();
    renderFavorites();
  }

  // --- Engine ---
  function tick() {
    elapsed++;
    if(elapsed >= totalTime()) {
      clearInterval(interval); running = false; done = true;
      if(soundOn) beep('done');
      vibrate(500);
      fireConfetti();
      $('brew-notes-card').hidden = false;
      render(true); return;
    }
    
    // Stage logic
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
    render(true); // pass true to skip DOM reflow of stages
  }
  
  function reset() {
    clearInterval(interval); running = false; elapsed = 0; stageIdx = 0; stageElapsed = 0; done = false; prevStageIdx = -1;
    $('brew-notes-card').hidden = true;
    currentNoteRating = '';
    $('notes-text').value = '';
    document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('active'));
  }

  // --- Events ---
  $('theme-toggle').onclick = () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', theme);
    $('theme-toggle').textContent = theme === 'dark' ? '🌙' : '☀️';
    localStorage.setItem('theme', theme);
  };
  
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
      running = true; interval = setInterval(tick, 1000);
    } else { clearInterval(interval); running = false; }
    render(true);
  };

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if(document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
    if(e.code === 'Space') { e.preventDefault(); $('btn-start').click(); }
    if(e.code === 'KeyR') { $('btn-reset').click(); }
  });

  // --- Notes & History ---
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentNoteRating = btn.dataset.r;
    };
  });
  
  $('btn-save-note').onclick = () => {
    const entry = {
      date: new Date().toISOString(),
      method: activeMethod().name,
      grams: grams,
      water: water(),
      ratio: activeMethod().ratio,
      rating: currentNoteRating,
      note: $('notes-text').value
    };
    history.unshift(entry);
    localStorage.setItem('brewHistory', JSON.stringify(history));
    $('brew-notes-card').hidden = true;
    showToast('Saved to history!');
    render();
  };
  
  $('btn-skip-note').onclick = () => { $('brew-notes-card').hidden = true; };

  // --- Modals Logic ---
  $('btn-history').onclick = () => { $('history-modal').hidden = false; };
  $('history-close').onclick = () => { $('history-modal').hidden = true; };
  $('btn-clear-history').onclick = () => { history = []; localStorage.setItem('brewHistory', '[]'); render(); };
  
  $('btn-favorites').onclick = () => { $('favorites-modal').hidden = false; };
  $('favorites-close').onclick = () => { $('favorites-modal').hidden = true; };
  
  $('btn-save-fav').onclick = () => {
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

  function renderHistory() {
    const b = $('history-body');
    if(history.length === 0) b.innerHTML = '<p class="empty-state">No brews logged yet.</p>';
    else {
      b.innerHTML = history.map(h => `
        <div class="log-item">
          <div>
            <div class="log-title">${h.method} — ${h.grams}g</div>
            <div class="log-sub">${new Date(h.date).toLocaleDateString()} · 1:${h.ratio}</div>
            ${h.note ? `<div class="log-sub" style="font-style:italic">"${h.note}"</div>` : ''}
          </div>
          <div class="log-rating">${h.rating==='sour'?'😖':h.rating==='balanced'?'😊':h.rating==='bitter'?'😣':'☕'}</div>
        </div>
      `).join('');
    }
  }

  function renderFavorites() {
    const b = $('favorites-body');
    if(favorites.length === 0) b.innerHTML = '<p class="empty-state">No favorites saved yet.</p>';
    else {
      b.innerHTML = favorites.map((f, i) => `
        <div class="log-item">
          <div>
            <div class="log-title">${f.name}</div>
            <div class="log-sub">${METHODS.find(m=>m.id===f.method)?.name} · ${f.grams}g</div>
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
    method = METHODS.find(m=>m.id===f.method) || METHODS[0];
    grams = f.grams;
    
    $('favorites-modal').hidden = true;
    reset(); render(); showToast('Loaded recipe!');
  };
  
  window.delFav = (i) => {
    favorites.splice(i, 1);
    localStorage.setItem('brewFavs', JSON.stringify(favorites));
    render();
  };

  // Initial render
  render();
});
