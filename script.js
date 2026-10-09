(function () {
  const API_URL = "http://127.0.0.1:8000";

  let options = [];
  let currentScenario = "";
  let bubbleNodes = {};     // option text -> { el, vx, vy } — persists across renders now
  let animFrameId = null;
  let lastFrameTime = null;

  const appContainer = document.getElementById('app-container');
  const optionInput   = document.getElementById('option-input');
  const bubbleContainer = document.getElementById('bubble-container');
  const inputHint = document.querySelector('.input-hint');
  const startBtn   = document.getElementById('start-btn');
  const submitBtn  = document.getElementById('submit-btn');
  const restartBtn = document.getElementById('restart-btn');

  const step1 = document.getElementById('step-1');
  const step2 = document.getElementById('step-2');
  const step3 = document.getElementById('step-3');

  optionInput.addEventListener('keypress', (e) => {
    if (e.key !== 'Enter') return;
    const value = optionInput.value.trim();
    if (value && options.length < 6 && !options.includes(value)) {
      addOption(value);
      optionInput.value = '';
    }
    if (options.length >= 6) optionInput.blur();
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function randomSpotAvoidingCard(size) {
    const card = document.querySelector('.card').getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let x, y, tries = 0;
    do {
      x = Math.random() * (vw - size);
      y = Math.random() * (vh - size);
      tries++;
    } while (
      tries < 30 &&
      x + size > card.left && x < card.right &&
      y + size > card.top  && y < card.bottom
    );
    return { x, y };
  }

  // ---- Add/remove ONE bubble at a time — this is what stops every bubble
  // from resetting when you press Enter. Everything else stays untouched. ----

  function addOption(text) {
    options.push(text);

    const spot = randomSpotAvoidingCard(90);
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.style.left = spot.x + 'px';
    bubble.style.top = spot.y + 'px';
    bubble.innerHTML = `<span>${escapeHtml(text)}</span>`;

    // Make the bubble itself clickable
    bubble.addEventListener('click', () => removeOption(text));

    bubbleContainer.appendChild(bubble);

    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 35; // px/sec
    bubbleNodes[text] = { el: bubble, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };

    updateBubbleUI();
    ensurePhysicsRunning();
  }


  function removeOption(text) {
    const idx = options.indexOf(text);
    if (idx === -1) return;
    options.splice(idx, 1);

    const node = bubbleNodes[text];
    if (node) node.el.remove();
    delete bubbleNodes[text];

    updateBubbleUI();
  }

  function updateBubbleUI() {
    inputHint.textContent = `${options.length} / 6 added`;
    startBtn.classList.toggle('hidden', options.length === 0);
    optionInput.disabled = options.length >= 6;
  }

  // ---- Physics loop: wall bounce + bubble-vs-bubble collision ----------

  function ensurePhysicsRunning() {
    if (animFrameId === null) {
      lastFrameTime = null;
      animFrameId = requestAnimationFrame(stepPhysics);
    }
  }

  function stepPhysics(timestamp) {
    const nodes = Object.values(bubbleNodes);
    if (nodes.length === 0) { animFrameId = null; return; }

    if (lastFrameTime === null) lastFrameTime = timestamp;
    const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.05); // clamp so tab-switching doesn't cause a huge jump
    lastFrameTime = timestamp;

    const vw = window.innerWidth, vh = window.innerHeight;

    // 1. Move each bubble, bounce off screen edges
    const state = nodes.map(node => {
      const rect = node.el.getBoundingClientRect();
      let x = rect.left + node.vx * dt;
      let y = rect.top + node.vy * dt;
      const w = rect.width, h = rect.height;

      if (x <= 0)      { x = 0;      node.vx = Math.abs(node.vx); }
      if (x + w >= vw) { x = vw - w; node.vx = -Math.abs(node.vx); }
      if (y <= 0)      { y = 0;      node.vy = Math.abs(node.vy); }
      if (y + h >= vh) { y = vh - h; node.vy = -Math.abs(node.vy); }

      return { node, x, y, r: w / 2 };
    });

    // 2. Bubble-vs-bubble collision (simple equal-mass elastic bounce)
    for (let i = 0; i < state.length; i++) {
      for (let j = i + 1; j < state.length; j++) {
        const A = state[i], B = state[j];
        const acx = A.x + A.r, acy = A.y + A.r;
        const bcx = B.x + B.r, bcy = B.y + B.r;
        const dx = bcx - acx, dy = bcy - acy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const minDist = A.r + B.r;

        if (dist < minDist) {
          const nx = dx / dist, ny = dy / dist;
          const overlap = (minDist - dist) / 2;

          // push them apart so they don't overlap/stick
          A.x -= nx * overlap; A.y -= ny * overlap;
          B.x += nx * overlap; B.y += ny * overlap;

          // reflect velocity along the collision normal (equal-mass elastic swap)
          const vn1 = A.node.vx * nx + A.node.vy * ny;
          const vn2 = B.node.vx * nx + B.node.vy * ny;
          if (vn2 - vn1 < 0) {
            A.node.vx += (vn2 - vn1) * nx;
            A.node.vy += (vn2 - vn1) * ny;
            B.node.vx += (vn1 - vn2) * nx;
            B.node.vy += (vn1 - vn2) * ny;
          }
        }
      }
    }

    // 3. Apply final positions
    state.forEach(s => {
      s.node.el.style.left = s.x + 'px';
      s.node.el.style.top = s.y + 'px';
    });

    animFrameId = requestAnimationFrame(stepPhysics);
  }

  // ---- Transition: whirlpool bubbles into the center, then generate scenario --

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    cancelAnimationFrame(animFrameId);
    animFrameId = null;

    const bubbles = Object.values(bubbleNodes).map(n => n.el);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    bubbles.forEach((b, i) => {
      const rect = b.getBoundingClientRect();
      const dx = centerX - (rect.left + rect.width / 2);
      const dy = centerY - (rect.top + rect.height / 2);

      b.animate(
        [
          { transform: 'translate(0px, 0px) rotate(0deg) scale(1)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) rotate(720deg) scale(0)`, opacity: 0 }
        ],
        { duration: 650, easing: 'cubic-bezier(0.55, 0, 0.85, 0.35)', delay: i * 45, fill: 'forwards' }
      );
    });

    const totalDelay = 650 + bubbles.length * 45 + 60;

    setTimeout(async () => {
      try {
        currentScenario = await generateScenario(options);
        document.getElementById('scenario-text').textContent = currentScenario;
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
        step2.classList.add('entering');
      } catch (err) {
        alert("Couldn't reach the server — make sure app.py is running on port 8000.");
        bubbles.forEach(b => b.getAnimations().forEach(a => a.cancel()));
        ensurePhysicsRunning();
        startBtn.disabled = false;
      }
    }, totalDelay);
  });

  // ---- Step 2 -> Step 3: analyze reaction --------------------------------

  submitBtn.addEventListener('click', async () => {
    const userText = document.getElementById('user-response').value.trim();
    if (!userText) { alert("Type a quick reaction first!"); return; }

    submitBtn.textContent = "Analyzing Vibe…";
    submitBtn.disabled = true;

    try {
      const result = await analyzeChoice(options, currentScenario, userText);
      document.getElementById('result-title').textContent = result.winning_choice;
      document.getElementById('result-summary').textContent = result.vibe_summary;
      document.querySelector('.card').style.setProperty('--result-color', result.aura_color);
      step2.classList.add('hidden');
      step3.classList.remove('hidden');
      step3.classList.add('entering');
    } catch (err) {
      alert("Error analyzing your reaction. Please try again.");
      submitBtn.textContent = "Reveal Winning Option →";
      submitBtn.disabled = false;
    }
  });

  restartBtn.addEventListener('click', () => {
    step3.classList.add('hidden'); step3.classList.remove('entering');
    step2.classList.add('hidden'); step2.classList.remove('entering');
    step1.classList.remove('hidden');

    document.getElementById('user-response').value = '';
    document.getElementById('scenario-text').textContent = 'Generating a scenario…';
    document.getElementById('result-title').textContent = '—';
    document.getElementById('result-summary').textContent = 'Explanation here…';
    currentScenario = '';

    document.querySelector('.card').style.removeProperty('--result-color');

    startBtn.disabled = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Reveal Winning Option →';

    try {
      // Cancel the whirlpool animations first and clear their leftover
      // inline transform/opacity so each bubble is back to its natural,
      // fully-visible state before we try to measure or reposition it.
      Object.values(bubbleNodes).forEach(node => {
        node.el.getAnimations().forEach(anim => anim.cancel());
        node.el.style.transform = 'none';
        node.el.style.opacity = '1';
        node.el.style.zIndex = '1';
      });

      updateBubbleUI();

      // Wait a frame so the browser finishes laying out #step-1 (just
      // unhidden) before we measure the card / viewport.
      requestAnimationFrame(() => {
        try {
          // documentElement.clientWidth/Height excludes scrollbars and is
          // more reliable than window.innerWidth/Height for this.
          const vw = document.documentElement.clientWidth;
          const vh = document.documentElement.clientHeight;

          Object.entries(bubbleNodes).forEach(([text, node]) => {
            const rect = node.el.getBoundingClientRect();
            const size = rect.width > 0 ? rect.width : 90;

            const spot = randomSpotAvoidingCard(size);
            const x = Math.min(Math.max(spot.x, 0), Math.max(vw - size, 0));
            const y = Math.min(Math.max(spot.y, 0), Math.max(vh - size, 0));

            console.log('respawn', text, { vw, vh, size, x, y });

            node.el.style.left = x + 'px';
            node.el.style.top = y + 'px';

            const angle = Math.random() * Math.PI * 2;
            const speed = 35 + Math.random() * 35;
            node.vx = Math.cos(angle) * speed;
            node.vy = Math.sin(angle) * speed;
          });

          ensurePhysicsRunning();
        } catch (innerErr) {
          console.error('Bubble respawn (inner) failed:', innerErr);
        }
      });
    } catch (err) {
      console.error('Bubble respawn failed:', err);
    }
  });

  // ---- Real API calls to app.py ------------------------------------------

  async function generateScenario(opts) {
    const res = await fetch(`${API_URL}/generate-scenario`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choices: opts })
    });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    return (await res.json()).scenario;
  }

  async function analyzeChoice(opts, scenario, userText) {
    const res = await fetch(`${API_URL}/analyze-response`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choices: opts, scenario: scenario, user_text: userText })
    });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const data = await res.json();
    return { winning_choice: data.winning_choice, vibe_summary: data.vibe_summary, aura_color: data.color };
  }
})();