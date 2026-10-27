(() => {
  const EX = Object.fromEntries(EXERCISES.map(e => [e.id, e]));
  const MUSCLES = ['腿臀', '背', '胸', '肩', '核心'];
  const HOME_FILTER = '在家可做';
  const dot = m => `<i class="dot" data-m="${m}"></i>`;
  const icoFor = ex => `<span class="ico" data-m="${ex.muscle}">${illoFor(ex)}</span>`;
  // 器械配重片常見的重量
  const STACK = [4.5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59, 64, 68, 73, 77];
  const TYPE = { coach: '教練課', home: '在家', self: '自主' };

  const view = document.getElementById('view');
  const $title = document.getElementById('title');
  const $back = document.getElementById('back');

  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem('gym:' + k)); return v ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('gym:' + k, JSON.stringify(v)); } catch {} },
  };

  // 家裡的啞鈴（每支公斤數）
  const homeDB = () => store.get('homeDB', [3, 6, 12]);

  const state = { tab: 'lookup', detail: null, filter: '全部', q: '', mode: store.get('mode', 'gym'), parsed: null, logIdx: 0 };

  // ---------- 小工具 ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const fmtDate = d => { const [y, m, dd] = d.split('-'); return `${y}/${+m}/${+dd}`; };
  const shortDate = d => { const [, m, dd] = d.split('-'); return `${+m}/${+dd}`; };
  const daysAgo = d => Math.round((new Date(today()) - new Date(d)) / 86400000);
  const agoText = d => {
    const n = daysAgo(d);
    if (n <= 0) return '今天';
    if (n < 7) return `${n} 天前`;
    if (n < 60) return `${Math.round(n / 7)} 週前`;
    return `${Math.round(n / 30)} 個月前`;
  };
  const num = k => Number.isInteger(k) ? String(k) : String(Math.round(k * 10) / 10);
  const kgText = k => k == null ? '' : num(k) + 'kg';
  const pairHint = (ex, kg) => ex.pair && kg ? `每手 ${kgText(kg / 2)}` : '';
  const norm = s => s.toLowerCase().replace(/\s+/g, '');

  function celebrate() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#F2A497', '#F6D27A', '#A8D3E6', '#B9DAA5'];
    for (let i = 0; i < 24; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.background = colors[i % colors.length];
      c.style.borderRadius = i % 3 === 0 ? '50%' : i % 3 === 1 ? '3px' : '50% 0';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
      c.style.animationDelay = Math.random() * 0.4 + 's';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 3600);
    }
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  function fmtGroup([kg, reps, sets]) {
    const w = kgText(kg);
    let r = '';
    if (reps != null && sets != null && sets > 1) r = `${sets}×${reps}`;
    else if (reps != null) r = `${reps} 下`;
    else if (sets != null) r = `${sets} 組/趟`;
    return [w, r].filter(Boolean).join(' ') || '—';
  }
  const fmtGroups = gs => gs.map(fmtGroup).join('、');

  // ---------- 資料 ----------
  const mySessions = () => store.get('mySessions', []);
  const allSessions = () => [...HISTORY, ...mySessions()].sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);

  function historyOf(id) {
    const out = [];
    for (const s of allSessions()) for (const it of s.items) if (it[0] === id) out.push({ d: s.d, t: s.t, groups: it[1], raw: it[2] });
    return out;
  }

  function topKg(ex, groups) {
    const ks = groups.map(g => g[0]).filter(k => k != null);
    if (!ks.length) return null;
    return ex.assist ? Math.min(...ks) : Math.max(...ks);
  }
  const totalReps = groups => groups.reduce((s, [, r, n]) => s + (r ?? 0) * (n ?? 1), 0);
  const totalSets = groups => groups.reduce((s, g) => s + (g[2] ?? 1), 0);
  const better = (ex, a, b) => ex.assist ? a < b : a > b;

  function stats(id) {
    const ex = EX[id];
    const h = historyOf(id);
    const withKg = h.filter(x => topKg(ex, x.groups) != null);
    let best = null;
    for (const x of withKg) {
      const t = topKg(ex, x.groups);
      if (!best || better(ex, t, best.kg) || (t === best.kg && totalReps(x.groups) > best.reps)) best = { kg: t, reps: totalReps(x.groups), d: x.d, groups: x.groups };
    }
    let status = h.length ? 'flat' : 'new';
    if (withKg.length < 2) status = h.length ? 'few' : 'new';
    else {
      const a = topKg(ex, withKg.at(-1).groups), b = topKg(ex, withKg.at(-2).groups);
      status = a === b ? 'flat' : better(ex, a, b) ? 'up' : 'down';
    }
    const last3 = withKg.slice(-3).map(x => topKg(ex, x.groups));
    const stalled = last3.length === 3 && last3.every(v => v === last3[0]);
    return { h, withKg, last: h.at(-1) || null, best, status, stalled };
  }

  function nextKg(ex, k) {
    if (ex.equip === '器械') {
      if (ex.assist) { const lower = STACK.filter(x => x < k - 0.5); return lower.length ? lower.at(-1) : k; }
      return STACK.find(x => x > k + 0.5) ?? k + 5;
    }
    if (ex.equip === '槓') return k + 2.5;
    return k + 2;
  }

  function suggest(id) {
    const ex = EX[id];
    const st = stats(id);
    const def = { kg: null, reps: ex.role === 'main' ? 10 : 12, sets: 3 };
    if (!st.last) return { ...def, text: '還沒做過，先用輕的重量找感覺' };
    const groups = st.last.groups;
    const t = topKg(ex, groups);
    const reps = Math.max(0, ...groups.map(g => g[1] ?? 0)) || def.reps;
    const sets = Math.min(4, Math.max(3, totalSets(groups)));
    if (t == null) return { kg: null, reps, sets, text: `上次沒記重量，照上次（${fmtGroups(groups)}）再做一次` };
    const topG = groups.filter(g => g[0] === t);
    const topSets = totalSets(topG);
    const topReps = topG[0][1] ?? reps;
    if (topSets >= 3 && st.status !== 'down') {
      const n = nextKg(ex, t);
      if (n !== t) {
        const text = ex.assist
          ? `上次輔助 ${kgText(t)} 做滿 ${topSets} 組，試試把輔助降到 ${kgText(n)}`
          : `上次 ${kgText(t)} 做滿 ${topSets} 組，試試 ${kgText(n)}；太重就回到 ${kgText(t)}`;
        return { kg: n, reps: topReps, sets, text, up: true };
      }
    }
    return { kg: t, reps: topReps, sets, text: `維持 ${kgText(t)}，先把每組都做滿 ${topReps} 下` };
  }

  // 在家：換成家裡有的啞鈴
  function homeKg(ex, kg) {
    const have = homeDB();
    if (kg == null || !have.length || !['啞鈴', '壺鈴'].includes(ex.equip)) return kg;
    const target = ex.pair ? kg / 2 : kg;
    const pick = have.reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
    return ex.pair ? pick * 2 : pick;
  }

  // ---------- 畫面框架 ----------
  function setTitle(t, back) { $title.textContent = t; $back.hidden = !back; }

  function render() {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
    if (state.detail) return renderDetail(state.detail);
    ({ lookup: renderLookup, today: renderToday, progress: renderProgress, log: renderLog, add: renderAdd })[state.tab]();
  }

  document.getElementById('tabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.tab = b.dataset.tab; state.detail = null;
    render(); window.scrollTo(0, 0);
  });
  $back.addEventListener('click', () => { state.detail = null; render(); window.scrollTo(0, state.scrollY || 0); });

  function openDetail(id) { state.scrollY = window.scrollY; state.detail = id; render(); window.scrollTo(0, 0); }

  const statusBadge = st => ({
    up: '<span class="badge up">↑ 進步</span>',
    down: '<span class="badge down">↓ 退步</span>',
    flat: '<span class="badge">＝ 持平</span>',
    few: '<span class="badge">1 次</span>',
    new: '<span class="badge">新的</span>',
  })[st.status];

  // ---------- 動作速查 ----------
  function renderLookup() {
    setTitle('動作');
    const filters = ['全部', ...MUSCLES, HOME_FILTER];
    view.innerHTML = `
      <input class="search" id="q" type="search" placeholder="搜尋動作，例如 row、保蹲、肩推" value="${esc(state.q)}" autocomplete="off">
      <div class="chips">${filters.map(f => `<button class="chip ${f === state.filter ? 'on' : ''}" data-filter="${f}" ${MUSCLES.includes(f) ? `data-m="${f}"` : f === HOME_FILTER ? 'data-m="肩"' : 'data-m="胸"'}>${MUSCLES.includes(f) ? dot(f) : ''}${f}</button>`).join('')}</div>
      <div id="exlist"></div>`;
    view.querySelector('#q').addEventListener('input', e => { state.q = e.target.value; renderExList(); });
    view.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.filter; renderLookup(); }));
    renderExList();
  }

  function renderExList() {
    const q = norm(state.q);
    let list = EXERCISES.filter(e => {
      if (state.filter === HOME_FILTER && !e.home) return false;
      if (MUSCLES.includes(state.filter) && e.muscle !== state.filter) return false;
      if (!q) return true;
      return [e.zh, e.en, ...e.aliases].some(a => norm(a).includes(q));
    }).map(e => ({ e, st: stats(e.id) }));
    list.sort((a, b) => (b.st.last?.d || '').localeCompare(a.st.last?.d || ''));

    const row = ({ e, st }) => `
      <button class="row" data-ex="${e.id}" data-m="${e.muscle}">
        ${icoFor(e)}
        <div class="main">
          <div class="name">${esc(e.zh)} <span class="en">${esc(e.en)}</span></div>
          <div class="last">${st.last ? `上次 ${shortDate(st.last.d)}・${esc(fmtGroups(st.last.groups))}` : '還沒有紀錄'}</div>
        </div>
        ${statusBadge(st)}<span class="chev">›</span>
      </button>`;

    const box = view.querySelector('#exlist');
    if (!list.length) { box.innerHTML = '<div class="empty">找不到這個動作</div>'; return; }
    if (state.filter === '全部' && !q) {
      box.innerHTML = MUSCLES.map(m => {
        const items = list.filter(x => x.e.muscle === m);
        return `<h2><span class="pill" data-m="${m}">${m}</span><span class="small muted">${items.length} 個動作</span></h2><div class="list">${items.map(row).join('')}</div>`;
      }).join('');
    } else {
      box.innerHTML = `<div class="list" style="margin-top:8px">${list.map(row).join('')}</div>`;
    }
    box.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => openDetail(b.dataset.ex)));
  }

  // ---------- 動作詳細 ----------
  function chartSVG(ex, rows) {
    const pts = rows.map(x => ({ d: x.d, v: topKg(ex, x.groups) }));
    const W = 340, H = 180, pl = 36, pr = 14, pt = 22, pb = 28;
    const vs = pts.map(p => p.v);
    let lo = Math.min(...vs), hi = Math.max(...vs);
    if (lo === hi) { lo -= 2; hi += 2; }
    const pv = (hi - lo) * 0.15; lo -= pv; hi += pv;
    const iw = W - pl - pr, ih = H - pt - pb;
    const x = i => pl + (pts.length === 1 ? iw / 2 : i * iw / (pts.length - 1));
    const y = v => ex.assist ? pt + (v - lo) / (hi - lo) * ih : pt + ih - (v - lo) / (hi - lo) * ih;
    const ticks = [0, 0.5, 1].map(f => lo + (hi - lo) * f);
    const bestV = ex.assist ? Math.min(...vs) : Math.max(...vs);
    const showVal = i => pts.length <= 10 || i === 0 || i === pts.length - 1 || pts[i].v === bestV;
    const xl = pts.length > 4 ? [0, Math.floor((pts.length - 1) / 2), pts.length - 1] : pts.map((_, i) => i);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="重量趨勢">
      ${ticks.map(t => `<line class="axis" x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}"/><text x="${pl - 6}" y="${y(t) + 4}" text-anchor="end">${Math.round(t)}</text>`).join('')}
      <path class="area" d="M${x(0)},${pt + ih} ${pts.map((p, i) => `L${x(i)},${y(p.v)}`).join(' ')} L${x(pts.length - 1)},${pt + ih}Z"/>
      <polyline class="lineplot" points="${pts.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')}"/>
      ${pts.map((p, i) => `<circle class="dot" cx="${x(i)}" cy="${y(p.v)}" r="4"/>${showVal(i) ? `<text class="val" x="${x(i)}" y="${y(p.v) - 9}" text-anchor="middle">${num(p.v)}</text>` : ''}`).join('')}
      ${xl.map(i => `<text x="${x(i)}" y="${H - 8}" text-anchor="${i === 0 && pts.length > 1 ? 'start' : i === pts.length - 1 && pts.length > 1 ? 'end' : 'middle'}">${shortDate(pts[i].d)}</text>`).join('')}
    </svg>`;
  }

  function renderDetail(id) {
    const ex = EX[id];
    const st = stats(id);
    const sg = suggest(id);
    setTitle(ex.zh, true);
    const last = st.last;
    const lastKg = last ? topKg(ex, last.groups) : null;
    view.innerHTML = `<div data-m="${ex.muscle}">
      <div class="hero">
        <div class="art">${illoFor(ex)}</div>
        <div>
          <div class="en">${esc(ex.en)}</div>
          <span class="badge m">${ex.muscle}</span> <span class="badge">${ex.equip}</span>
          ${ex.home ? '<span class="badge home">在家可做</span>' : ''}
        </div>
      </div>

      <div class="big-stat">
        <div class="card">
          <div class="label">上次・${last ? `${shortDate(last.d)}（${agoText(last.d)}）` : '—'}</div>
          <div class="value">${last ? esc(fmtGroups(last.groups)) : '—'}</div>
          ${pairHint(ex, lastKg) ? `<div class="small muted">${pairHint(ex, lastKg)}</div>` : ''}
        </div>
        <div class="card">
          <div class="label">${ex.assist ? '最少輔助' : '最重紀錄'}${st.best ? `・${shortDate(st.best.d)}` : ''}</div>
          <div class="value">${st.best ? kgText(st.best.kg) : '—'}</div>
          ${st.best ? `<div class="small muted">${esc(fmtGroups(st.best.groups))}</div>` : ''}
        </div>
      </div>

      <div class="card suggest">
        <div class="label">這次建議</div>
        <div class="value">${sg.kg != null ? kgText(sg.kg) : '—'} <small>${sg.sets} 組 × ${sg.reps} 下${pairHint(ex, sg.kg) ? `（${pairHint(ex, sg.kg)}）` : ''}</small></div>
        <div class="small">${esc(sg.text)}</div>
        ${st.stalled && !sg.up ? '<div class="small" style="margin-top:4px">已經連續 3 次同樣重量了，可以跟教練討論加重。</div>' : ''}
      </div>

      ${st.withKg.length >= 2 ? `
        <h2>重量趨勢 ${ex.assist ? '<span class="small">（輔助重量，越低越強，所以圖是倒過來的）</span>' : ''}</h2>
        <div class="card">${chartSVG(ex, st.withKg)}</div>` : ''}

      ${ex.cues.length ? `
        <h2>教練提醒</h2>
        <div class="card"><ul class="cues">${ex.cues.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}

      ${tutorialHTML(id)}

      <h2>全部紀錄（${st.h.length} 次）</h2>
      <div class="card">
        ${st.h.length ? `<table class="hist">${[...st.h].reverse().map(x => `
          <tr><td>${fmtDate(x.d)}<br><span class="badge ${x.t}">${TYPE[x.t]}</span></td>
          <td><strong>${esc(fmtGroups(x.groups))}</strong><div class="small muted">${esc(x.raw || '')}</div></td></tr>`).join('')}</table>` : '<div class="muted">還沒有紀錄</div>'}
      </div>
    </div>`;
  }

  // 動作教學：示範動畫＋分解圖＋文字
  function tutorialHTML(id) {
    const tu = TUTORIALS[id];
    if (!tu) return '';
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const labels = poseLabels(id);
    return `
      <h2 id="tutorial">動作教學</h2>
      <div class="card tut">
        ${still ? '' : `<div class="stage">${poseSVG(id, 'anim')}</div>`}
        <div class="frames">
          ${labels.map((l, i) => `<figure>${poseSVG(id, i)}<figcaption><b>${i + 1}</b>${esc(l)}</figcaption></figure>`).join('')}
        </div>
        <h4>步驟</h4>
        <ol class="steps">${tu.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        <h4>常見錯誤</h4>
        <ul class="oops">${tu.mistakes.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        <p class="target"><span class="badge m">練到</span> ${esc(tu.target)}</p>
        <p class="small muted" style="margin-bottom:0">一般教學僅供參考，以教練說的為準。</p>
      </div>`;
  }

  // ---------- 今天練 ----------
  const SLOTS = {
    gym: [
      { label: '下肢主項', pool: e => e.muscle === '腿臀' && e.role === 'main' },
      { label: '下肢輔助', pool: e => e.muscle === '腿臀' && e.role === 'acc' },
      { label: '背', pool: e => e.muscle === '背' },
      { label: '背', pool: e => e.muscle === '背' },
      { label: '推（肩／胸）', pool: e => ['肩', '胸'].includes(e.muscle) && e.role === 'main' },
      { label: '輔助／核心', pool: e => (e.muscle === '肩' && e.role === 'acc') || e.muscle === '核心' },
    ],
    home: [
      { label: '下肢主項', pool: e => e.muscle === '腿臀' && e.role === 'main' },
      { label: '下肢第二項', pool: e => e.muscle === '腿臀' },
      { label: '背', pool: e => e.muscle === '背' },
      { label: '推（肩／胸）', pool: e => ['肩', '胸'].includes(e.muscle) && e.role === 'main' },
      { label: '肩膀輔助', pool: e => e.muscle === '肩' && e.role === 'acc' },
      { label: '核心／減脂收尾', pool: e => e.muscle === '核心' },
    ],
  };

  function candidates(mode, slot, exclude) {
    return EXERCISES.filter(e => slot.pool(e) && e.id !== 'thoracic' && !exclude.includes(e.id) && (mode === 'gym' || e.home));
  }

  // 越久沒做、越熟悉的動作分數越高，再加一點隨機
  function score(e) {
    const h = historyOf(e.id);
    const since = h.length ? daysAgo(h.at(-1).d) : 45;
    return Math.min(since, 60) + Math.min(h.length, 5) * 3 + Math.random() * 15;
  }
  function pick(mode, slot, exclude) {
    const c = candidates(mode, slot, exclude);
    if (!c.length) return null;
    return c.map(e => ({ e, s: score(e) })).sort((a, b) => b.s - a.s)[0].e.id;
  }

  function buildItem(id, slot, mode) {
    const ex = EX[id];
    const sg = suggest(id);
    const kg = mode === 'home' ? homeKg(ex, sg.kg) : sg.kg;
    const reps = mode === 'home' && ex.role === 'main' ? Math.max(sg.reps, 12) : sg.reps;
    return { id, slot, sets: Array.from({ length: sg.sets }, () => ({ kg, reps, done: false })) };
  }

  function newWorkout(mode) {
    const chosen = [];
    const items = [];
    SLOTS[mode].forEach((slot, i) => {
      const id = pick(mode, slot, chosen);
      if (!id) return;
      chosen.push(id);
      items.push({ ...buildItem(id, slot.label, mode), slotIdx: i });
    });
    return { mode, d: today(), items, note: '' };
  }

  const getWorkout = () => store.get('workout', null);
  const saveWorkout = w => store.set('workout', w);

  function renderToday() {
    setTitle('今天練');
    const w = getWorkout();
    if (!w) {
      const home = homeDB();
      view.innerHTML = `
        <div class="seg">
          <button data-mode="gym" class="${state.mode === 'gym' ? 'on' : ''}">${illo('machine', false)}健身房</button>
          <button data-mode="home" class="${state.mode === 'home' ? 'on' : ''}">${illo('dumbbell', false)}在家</button>
        </div>
        <div class="welcome">${state.mode === 'gym'
          ? illo('kettlebell') + illo('pullup') + illo('barbell')
          : illo('dumbbell') + illo('body') + illo('dumbbell')}</div>
        <div class="card">
          ${state.mode === 'gym'
            ? '<p style="margin-top:0">照教練常排的結構產生菜單：<br>1 個下肢主項＋1 個下肢輔助＋2 個背＋1 個推＋1 個輔助／核心。</p>'
            : `<p style="margin-top:0">只用啞鈴和徒手動作：<br>下肢 2 個＋背＋推＋肩膀輔助＋核心收尾。<br>主項做 12 下以上，對減脂比較有幫助。</p>
               <p class="small muted">${home.length ? `家裡的啞鈴：${home.map(kgText).join('、')}（每支）` : '還沒設定家裡有幾公斤的啞鈴，可以到「新增」分頁設定，建議重量會更準。'}</p>`}
          <p class="small muted" style="margin-bottom:0">會優先排比較久沒練到的動作，重量依照上次紀錄自動帶入。</p>
        </div>
        <button class="btn block" id="gen">產生今天的菜單</button>`;
      view.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { state.mode = b.dataset.mode; store.set('mode', state.mode); renderToday(); }));
      view.querySelector('#gen').addEventListener('click', () => { saveWorkout(newWorkout(state.mode)); renderToday(); });
      return;
    }

    const doneCount = w.items.reduce((s, it) => s + it.sets.filter(x => x.done).length, 0);
    const allCount = w.items.reduce((s, it) => s + it.sets.length, 0);
    view.innerHTML = `
      <div>${w.mode === 'home' ? '在家' : '健身房'}・${fmtDate(w.d)}・完成 ${doneCount}/${allCount} 組${doneCount === allCount ? '，全部完成！' : ''}</div>
      <div class="progress-pill"><div style="width:${allCount ? doneCount / allCount * 100 : 0}%"></div></div>
      ${w.items.map((it, i) => workoutCard(w, it, i)).join('')}
      <div class="field" style="margin-top:14px">
        <label>今天的感覺（哪裡痠、哪裡累，之後可以給教練看）</label>
        <textarea id="note" style="min-height:80px">${esc(w.note || '')}</textarea>
      </div>
      <button class="btn block" id="finish">完成並儲存</button>
      <div class="btn-row">
        <button class="btn ghost" id="regen">重新產生</button>
        <button class="btn ghost" id="drop">放棄這份菜單</button>
      </div>`;

    view.querySelectorAll('input[data-f]').forEach(inp => inp.addEventListener('input', () => {
      const ww = getWorkout();
      const s = ww.items[+inp.dataset.i].sets[+inp.dataset.s];
      const v = inp.value.trim();
      s[inp.dataset.f] = v === '' ? null : Number(v);
      saveWorkout(ww);
    }));
    view.querySelectorAll('[data-check]').forEach(b => b.addEventListener('click', () => {
      const ww = getWorkout();
      const [i, s] = b.dataset.check.split(',').map(Number);
      const set = ww.items[i].sets[s];
      set.done = !set.done;
      saveWorkout(ww);
      if (set.done) startTimer(EX[ww.items[i].id].role === 'main' ? 90 : 60);
      renderToday();
    }));
    view.querySelectorAll('[data-addset]').forEach(b => b.addEventListener('click', () => {
      const ww = getWorkout();
      const it = ww.items[+b.dataset.addset];
      const lastSet = it.sets.at(-1) || { kg: null, reps: 10 };
      it.sets.push({ kg: lastSet.kg, reps: lastSet.reps, done: false });
      saveWorkout(ww); renderToday();
    }));
    view.querySelectorAll('[data-swap]').forEach(b => b.addEventListener('click', () => {
      const ww = getWorkout();
      const i = +b.dataset.swap;
      const it = ww.items[i];
      const slot = SLOTS[ww.mode][it.slotIdx];
      const used = ww.items.map(x => x.id);
      const c = candidates(ww.mode, slot, used);
      if (!c.length) { toast('這個位置沒有其他動作可以換'); return; }
      const id = c[Math.floor(Math.random() * c.length)].id;
      ww.items[i] = { ...buildItem(id, it.slot, ww.mode), slotIdx: it.slotIdx };
      saveWorkout(ww); renderToday();
    }));
    view.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => {
      openDetail(b.dataset.open);
      document.getElementById('tutorial')?.scrollIntoView();
    }));
    view.querySelector('#note').addEventListener('input', e => { const ww = getWorkout(); ww.note = e.target.value; saveWorkout(ww); });
    view.querySelector('#regen').addEventListener('click', () => {
      if (doneCount && !confirm('已經打勾的組數會清掉，確定要重新產生？')) return;
      saveWorkout(newWorkout(w.mode)); renderToday();
    });
    view.querySelector('#drop').addEventListener('click', () => {
      if (!confirm('確定要放棄這份菜單？')) return;
      store.set('workout', null); stopTimer(); renderToday();
    });
    view.querySelector('#finish').addEventListener('click', finishWorkout);
  }

  function workoutCard(w, it, i) {
    const ex = EX[it.id];
    const st = stats(it.id);
    const sg = suggest(it.id);
    const substitute = w.mode === 'home' && !['啞鈴', '徒手'].includes(ex.equip) ? `（在家用啞鈴代替${ex.equip}）` : '';
    return `
      <div class="card" data-m="${ex.muscle}">
        <div class="ex-head">
          <div class="who">
            ${icoFor(ex)}
            <div>
              <div class="slot">${dot(ex.muscle)}${esc(it.slot)}</div>
              <h3>${esc(ex.zh)}</h3>
              <div class="small muted">${esc(ex.en)}</div>
            </div>
          </div>
          <div class="tools">
            <button class="btn ghost sm" data-open="${it.id}">教學</button>
            <button class="btn ghost sm" data-swap="${i}">換一個</button>
          </div>
        </div>
        <div class="hint">
          ${st.last ? `上次 ${shortDate(st.last.d)}：<strong>${esc(fmtGroups(st.last.groups))}</strong>` : '還沒做過'}
          ${substitute}<br><span class="sg">${esc(sg.text)}${pairHint(ex, it.sets[0]?.kg) ? `（${pairHint(ex, it.sets[0].kg)}）` : ''}</span>
        </div>
        ${ex.cues[0] ? `<div class="cue1">${esc(ex.cues[0])}</div>` : ''}
        <div class="sets">
          <div class="h">組</div><div class="h">公斤${ex.pair ? '（兩手合計）' : ''}</div><div class="h">次數</div><div class="h"></div>
          ${it.sets.map((s, j) => `
            <div class="n">${j + 1}</div>
            <div class="${s.done ? 'done-row' : ''}"><input inputmode="decimal" data-f="kg" data-i="${i}" data-s="${j}" value="${s.kg ?? ''}" placeholder="—"></div>
            <div class="${s.done ? 'done-row' : ''}"><input inputmode="numeric" data-f="reps" data-i="${i}" data-s="${j}" value="${s.reps ?? ''}" placeholder="—"></div>
            <button class="check ${s.done ? 'done' : ''}" data-check="${i},${j}" aria-label="完成第 ${j + 1} 組">${s.done ? illo('check', false) : ''}</button>`).join('')}
        </div>
        <button class="btn ghost sm" style="margin-top:8px" data-addset="${i}">＋ 加一組</button>
      </div>`;
  }

  function finishWorkout() {
    const w = getWorkout();
    const items = [];
    for (const it of w.items) {
      const done = it.sets.filter(s => s.done);
      if (!done.length) continue;
      // 相同重量、次數的組數合併
      const groups = [];
      for (const s of done) {
        const g = groups.at(-1);
        if (g && g[0] === s.kg && g[1] === s.reps) g[2]++;
        else groups.push([s.kg, s.reps, 1]);
      }
      items.push([it.id, groups, '']);
    }
    if (!items.length) { toast('還沒有打勾任何一組'); return; }
    const list = mySessions();
    list.push({ d: w.d, t: w.mode === 'home' ? 'home' : 'self', items, note: w.note || '', id: Date.now() });
    store.set('mySessions', list);
    store.set('workout', null);
    stopTimer();
    celebrate();
    toast('今天也很棒！已儲存');
    state.tab = 'log'; state.logIdx = 0; render();
  }

  // ---------- 休息計時 ----------
  const $timer = document.getElementById('timer');
  const $left = document.getElementById('timer-left');
  let timerEnd = 0, timerId = null;
  function startTimer(sec) {
    timerEnd = Date.now() + sec * 1000;
    $timer.hidden = false;
    clearInterval(timerId);
    tick(); timerId = setInterval(tick, 250);
  }
  function tick() {
    const left = Math.max(0, Math.round((timerEnd - Date.now()) / 1000));
    $left.textContent = `${Math.floor(left / 60)}:${pad(left % 60)}`;
    if (left <= 0) { stopTimer(); toast('休息結束，下一組！'); navigator.vibrate?.(300); }
  }
  function stopTimer() { clearInterval(timerId); $timer.hidden = true; }
  document.getElementById('timer-add').addEventListener('click', () => { timerEnd += 30000; tick(); });
  document.getElementById('timer-stop').addEventListener('click', stopTimer);

  // ---------- 進度 ----------
  function renderProgress() {
    setTitle('進度');
    const sessions = allSessions();
    const coach = sessions.filter(s => s.t === 'coach').length;
    const mine = sessions.length - coach;

    // 最近 8 週各部位練了幾個動作
    const recent = sessions.filter(s => daysAgo(s.d) <= 56);
    const byMuscle = Object.fromEntries(MUSCLES.map(m => [m, 0]));
    for (const s of recent) for (const it of s.items) if (EX[it[0]]) byMuscle[EX[it[0]].muscle]++;
    const maxM = Math.max(1, ...Object.values(byMuscle));
    const missing = MUSCLES.filter(m => byMuscle[m] === 0);

    // 進步幅度：第一次 vs 最近一次的重量
    const prog = EXERCISES.map(e => {
      const st = stats(e.id);
      if (st.withKg.length < 2) return null;
      const a = topKg(e, st.withKg[0].groups), b = topKg(e, st.withKg.at(-1).groups);
      const pct = e.assist ? (a - b) / a : (b - a) / a;
      return { e, a, b, pct, st };
    }).filter(Boolean).sort((x, y) => y.pct - x.pct);

    // 每月次數
    const months = {};
    for (const s of sessions) { const k = s.d.slice(0, 7); months[k] = (months[k] || 0) + 1; }
    const mKeys = Object.keys(months).sort().slice(-12);
    const maxMo = Math.max(1, ...mKeys.map(k => months[k]));

    view.innerHTML = `
      <div class="big-stat">
        <div class="card fill-coral"><div class="label">教練課</div><div class="value">${coach} <small>堂</small></div></div>
        <div class="card fill-mizu"><div class="label">自己練</div><div class="value">${mine} <small>次</small></div></div>
      </div>

      <h2>最近 8 週練到的部位（動作數）</h2>
      <div class="card bars">
        ${MUSCLES.map(m => `<div class="bar" data-m="${m}"><span>${dot(m)}${m}</span><div class="track"><div class="fill" style="width:${byMuscle[m] / maxM * 100}%"></div></div><span class="num">${byMuscle[m]}</span></div>`).join('')}
        ${missing.length ? `<div class="small muted" style="margin-top:6px">最近都沒有練到：${missing.join('、')}，排菜單時可以補一下。</div>` : ''}
      </div>

      <h2>重量進步（第一次 → 最近一次）</h2>
      <div class="list">
        ${prog.map(({ e, a, b, pct, st }) => `
          <button class="row" data-ex="${e.id}" data-m="${e.muscle}">
            ${icoFor(e)}
            <div class="main">
              <div class="name">${esc(e.zh)}</div>
              <div class="last">${kgText(a)} → ${kgText(b)}${e.assist ? '（輔助）' : ''}・${st.withKg.length} 次紀錄</div>
            </div>
            <span class="badge ${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}">${pct > 0 ? '+' : ''}${Math.round(pct * 100)}%</span><span class="chev">›</span>
          </button>`).join('')}
      </div>
      <p class="small muted">輔助引體向上是看「輔助重量減少多少」，減少越多代表越強。</p>

      <h2>每月訓練次數</h2>
      <div class="card bars">
        ${mKeys.map(k => `<div class="bar" data-m="背"><span>${k.slice(0, 4) === today().slice(0, 4) ? '' : k.slice(2, 4) + '/'}${+k.slice(5)}月</span><div class="track"><div class="fill" style="width:${months[k] / maxMo * 100}%"></div></div><span class="num">${months[k]}</span></div>`).join('')}
      </div>`;
    view.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => openDetail(b.dataset.ex)));
  }

  // ---------- 紀錄 ----------
  // 一次看一天，用日期列或左右箭頭切換
  function renderLog(bounce = false) {
    setTitle('紀錄');
    const sessions = allSessions().reverse();
    if (!sessions.length) { view.innerHTML = '<div class="empty">還沒有紀錄</div>'; return; }
    const i = state.logIdx = Math.min(Math.max(state.logIdx, 0), sessions.length - 1);
    const s = sessions[i];
    const thisYear = today().slice(0, 4);
    view.innerHTML = `
      <div class="dates" id="dates">
        ${sessions.map((x, j) => `
          <button data-idx="${j}" class="${j === i ? 'on' : ''}" aria-label="${fmtDate(x.d)} ${TYPE[x.t]}">
            ${x.d.slice(0, 4) !== thisYear ? `<span class="y">${x.d.slice(0, 4)}</span>` : ''}
            <span class="md">${shortDate(x.d)}</span><i class="t-${x.t}"></i>
          </button>`).join('')}
      </div>
      <div class="datebar">
        <button class="arrow" id="newer" aria-label="較新的一次" ${i === 0 ? 'disabled' : ''}>‹</button>
        <div class="when">
          <div class="d">${fmtDate(s.d)}</div>
          <div class="small muted">${agoText(s.d)}・第 ${sessions.length - i} 次</div>
        </div>
        <button class="arrow" id="older" aria-label="較早的一次" ${i === sessions.length - 1 ? 'disabled' : ''}>›</button>
      </div>
      <div class="card ${bounce ? 'bounce-in' : ''}">
        <div class="ex-head" style="margin-bottom:6px">
          <span class="badge ${s.t}">${TYPE[s.t]}</span>
          ${s.id ? `<button class="btn ghost sm" data-del="${s.id}">刪除</button>` : ''}
        </div>
        ${s.items.map(it => {
          const ex = EX[it[0]];
          return `<div class="sess-item">${ex ? icoFor(ex) : ''}
            <div class="nm">${esc(ex?.zh || it[0])}<div class="g">${esc(fmtGroups(it[1]))}</div></div></div>`;
        }).join('')}
        ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
      </div>`;

    const go = j => { state.logIdx = j; renderLog(true); };
    view.querySelectorAll('[data-idx]').forEach(b => b.addEventListener('click', () => go(+b.dataset.idx)));
    view.querySelector('#newer').addEventListener('click', () => go(i - 1));
    view.querySelector('#older').addEventListener('click', () => go(i + 1));
    view.querySelector('#dates .on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    view.querySelector('[data-del]')?.addEventListener('click', e => {
      if (!confirm('確定要刪除這筆紀錄？')) return;
      store.set('mySessions', mySessions().filter(x => String(x.id) !== e.currentTarget.dataset.del));
      renderLog();
    });
  }

  // ---------- 解析教練的 LINE 紀錄 ----------
  const ALIAS = EXERCISES.flatMap(e => e.aliases.map(a => ({ a: norm(a), id: e.id }))).sort((x, y) => y.a.length - x.a.length);

  function matchExercise(line) {
    const n = norm(line);
    for (const { a, id } of ALIAS) {
      if (!n.includes(a)) continue;
      if (id === 'seatrow' && n.includes('single')) return 'singlerow';
      return id;
    }
    return null;
  }

  // 「16kg 4x10」→ [[16,10,4]]，「36kg/10 32kg 2x10」→ [[36,10,1],[32,10,2]]
  function parseNumbers(line) {
    const s = line.replace(/公斤/g, 'kg').replace(/[×＊*Ｘ]/g, 'x').replace(/／/g, '/')
      .replace(/(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*kg/gi, (_, a, b) => `${+a + +b}kg`);
    const re = /(\d+(?:\.\d+)?)\s*kg(?:\/|x)(\d+)(?!\s*x)|(\d+(?:\.\d+)?)\s*kg|(\d+)\s*x\s*(\d+)|x\s*(\d+)/gi;
    const groups = [];
    let cur = null, pending = false, m;
    while ((m = re.exec(s))) {
      if (m[1] != null) { if (pending) groups.push([cur, null, null]); cur = +m[1]; groups.push([cur, +m[2], 1]); pending = false; }
      else if (m[3] != null) { if (pending) groups.push([cur, null, null]); cur = +m[3]; pending = true; }
      else if (m[4] != null) { groups.push([cur, +m[5], +m[4]]); pending = false; }
      else { groups.push([cur, null, +m[6]]); pending = false; }
    }
    if (pending) {
      // 「保蹲 4x10 5kg」這種重量寫在後面的情況
      if (groups.length && groups.every(g => g[0] == null)) groups.forEach(g => { g[0] = cur; });
      else groups.push([cur, null, null]);
    }
    return groups;
  }

  function resolveDate(y, m, d) {
    const now = new Date();
    let year = y ? +y : now.getFullYear();
    let date = `${year}-${pad(+m)}-${pad(+d)}`;
    if (!y && date > today()) date = `${year - 1}-${pad(+m)}-${pad(+d)}`;
    return date;
  }

  function parseText(text, defaultDate) {
    let date = defaultDate;
    const entries = [];
    for (const raw of text.split(/\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const dm = line.match(/^#*\s*(?:(\d{4})[\/\-.])?(\d{1,2})[\/\-.](\d{1,2})\s*$/);
      if (dm) { date = resolveDate(dm[1], dm[2], dm[3]); continue; }
      if (/^[a-z.\s]+=/i.test(line)) continue; // 例如「LPD=Lat Pulldown」
      const id = matchExercise(line);
      const groups = parseNumbers(line);
      if (!id && !groups.length) continue;
      entries.push({ raw: line, edit: line, id, groups, date });
    }
    return entries;
  }

  const exOptions = sel => `<option value="">（略過這行）</option>` + MUSCLES.map(m =>
    `<optgroup label="${m}">${EXERCISES.filter(e => e.muscle === m).map(e => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${esc(e.zh)}</option>`).join('')}</optgroup>`).join('');

  function renderAdd() {
    setTitle('新增');
    const p = state.parsed;
    view.innerHTML = `
      <h2>貼上教練的 LINE 紀錄</h2>
      <div class="card">
        <div class="field"><label>日期（文字裡有「10/19」這種日期會自動用那個）</label><input type="date" id="date" value="${today()}"></div>
        <div class="field"><label>內容</label><textarea id="text" placeholder="10/26&#10;保蹲 10kg 4x10&#10;Seated row 23kg 3x10&#10;LPD 23kg 4x10"></textarea></div>
        <button class="btn block" id="parse">解析</button>
      </div>

      ${p ? `
        <h2>確認解析結果（黃色的要檢查）</h2>
        <div class="card" id="preview">
          ${p.map((x, i) => parsedRow(x, i)).join('')}
        </div>
        <div class="btn-row">
          <button class="btn" id="save">儲存 ${p.filter(x => x.id).length} 個動作</button>
          <button class="btn ghost" id="cancel">取消</button>
        </div>` : ''}

      <h2>家裡的啞鈴</h2>
      <div class="card">
        <div class="field"><label>每支幾公斤，用逗號分隔（例如 2, 4, 6）</label><input id="homedb" inputmode="decimal" value="${homeDB().join(', ')}"></div>
        <button class="btn ghost block" id="savedb">儲存</button>
      </div>

      <h2>備份</h2>
      <div class="card">
        <p class="small muted" style="margin-top:0">你新增的紀錄存在這支手機的瀏覽器裡。建議把網頁「加入主畫面」來用，並且定期匯出備份；要合併進 GitHub 上的正式紀錄時，把匯出的檔案交給 Claude 就可以。</p>
        <div class="btn-row">
          <button class="btn ghost" id="export">匯出</button>
          <label class="btn ghost" style="text-align:center">匯入<input type="file" id="import" accept="application/json,.json" hidden></label>
        </div>
      </div>`;

    view.querySelector('#parse').addEventListener('click', () => {
      const text = view.querySelector('#text').value;
      const entries = parseText(text, view.querySelector('#date').value || today());
      if (!entries.length) { toast('沒有找到可以解析的動作'); return; }
      state.parsed = entries; renderAdd();
      view.querySelector('#preview')?.scrollIntoView({ behavior: 'smooth' });
    });
    if (p) {
      view.querySelectorAll('[data-pex]').forEach(sel => sel.addEventListener('change', () => {
        state.parsed[+sel.dataset.pex].id = sel.value || null; renderAdd();
      }));
      view.querySelectorAll('[data-pedit]').forEach(inp => inp.addEventListener('change', () => {
        const x = state.parsed[+inp.dataset.pedit];
        x.edit = inp.value; x.groups = parseNumbers(inp.value); renderAdd();
      }));
      view.querySelectorAll('[data-pdate]').forEach(inp => inp.addEventListener('change', () => {
        state.parsed[+inp.dataset.pdate].date = inp.value;
      }));
      view.querySelector('#cancel').addEventListener('click', () => { state.parsed = null; renderAdd(); });
      view.querySelector('#save').addEventListener('click', saveParsed);
    }
    view.querySelector('#savedb').addEventListener('click', () => {
      const v = view.querySelector('#homedb').value.split(/[,，、\s]+/).map(Number).filter(n => n > 0).sort((a, b) => a - b);
      store.set('homeDB', v); toast('已儲存家裡的啞鈴');
    });
    view.querySelector('#export').addEventListener('click', exportData);
    view.querySelector('#import').addEventListener('change', importData);
  }

  function parsedRow(x, i) {
    const bad = !x.id || !x.groups.length;
    const noKg = x.id && x.groups.length && x.groups.every(g => g[0] == null) && !['徒手'].includes(EX[x.id].equip);
    return `
      <div class="parsed ${bad || noKg ? 'bad' : ''}">
        <div class="raw">${esc(x.raw)}</div>
        <div class="grid">
          <select data-pex="${i}">${exOptions(x.id)}</select>
          <input type="date" data-pdate="${i}" value="${x.date}">
        </div>
        <input data-pedit="${i}" value="${esc(x.edit)}" style="margin-top:6px" aria-label="修改這行">
        <div class="out">→ ${x.groups.length ? esc(fmtGroups(x.groups)) : '沒有讀到重量或次數'}${noKg ? '（沒有讀到公斤數，可以在上面那行補上「kg」）' : ''}</div>
      </div>`;
  }

  function saveParsed() {
    const ok = state.parsed.filter(x => x.id && x.groups.length);
    if (!ok.length) { toast('沒有可以儲存的動作'); return; }
    const byDate = {};
    for (const x of ok) (byDate[x.date] ||= []).push([x.id, x.groups, x.raw]);
    const dup = Object.keys(byDate).filter(d => allSessions().some(s => s.d === d && s.t === 'coach'));
    if (dup.length && !confirm(`${dup.map(fmtDate).join('、')} 已經有教練課紀錄了，還是要加進去嗎？`)) return;
    const list = mySessions();
    for (const [d, items] of Object.entries(byDate)) {
      const same = list.find(s => s.d === d && s.t === 'coach');
      if (same) same.items.push(...items);
      else list.push({ d, t: 'coach', items, id: Date.now() + Math.random() });
    }
    store.set('mySessions', list);
    state.parsed = null;
    celebrate();
    toast(`已儲存 ${ok.length} 個動作`);
    state.tab = 'log'; state.logIdx = 0; render(); window.scrollTo(0, 0);
  }

  function exportData() {
    const data = JSON.stringify({ version: 1, exported: today(), sessions: mySessions(), homeDB: homeDB() }, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = `重訓紀錄備份-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importData(e) {
    const file = e.target.files[0]; if (!file) return;
    file.text().then(t => {
      const data = JSON.parse(t);
      const list = mySessions();
      const key = s => s.d + s.t + JSON.stringify(s.items);
      const have = new Set(list.map(key));
      let added = 0;
      for (const s of data.sessions || []) if (!have.has(key(s))) { list.push(s); added++; }
      store.set('mySessions', list);
      if (data.homeDB?.length) store.set('homeDB', data.homeDB);
      toast(`匯入 ${added} 筆紀錄`); renderAdd();
    }).catch(() => toast('檔案格式不對'));
  }

  render();
})();
