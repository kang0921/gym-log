// 手繪風插圖：墨灰粗線＋平塗，畫布 64×64
(() => {
  const INK = '#3E3A39', CORAL = '#F2A497', YAMA = '#F6D27A', MIZU = '#A8D3E6', WAKA = '#B9DAA5', PAPER = '#FFFCF6';

  // 小臉：眼睛、嘴巴、腮紅
  const face = (cx, cy, blush = CORAL) => `
    <ellipse cx="${cx - 9}" cy="${cy + 3}" rx="3" ry="1.8" fill="${blush}" stroke="none"/>
    <ellipse cx="${cx + 9}" cy="${cy + 3}" rx="3" ry="1.8" fill="${blush}" stroke="none"/>
    <circle cx="${cx - 5}" cy="${cy}" r="2" fill="${INK}" stroke="none"/>
    <circle cx="${cx + 5}" cy="${cy}" r="2" fill="${INK}" stroke="none"/>
    <path d="M${cx - 2.5} ${cy + 3} q2.5 2.6 5 0" fill="none" stroke-width="2"/>`;

  const ART = {
    // 啞鈴
    dumbbell: `
      <path d="M30 10v5M23 12l2.5 4M39 12l-2.5 4" stroke-width="2.5"/>
      <rect x="18" y="28" width="28" height="8" rx="3" fill="${PAPER}"/>
      <rect x="3" y="25" width="8" height="14" rx="3" fill="${CORAL}"/>
      <rect x="53" y="25" width="8" height="14" rx="3" fill="${CORAL}"/>
      <rect x="9" y="18" width="11" height="28" rx="4" fill="${CORAL}"/>
      <rect x="44" y="18" width="11" height="28" rx="4" fill="${CORAL}"/>`,
    // 壺鈴
    kettlebell: `
      <path d="M21 33V23a11 11 0 0 1 22 0v10" fill="none" stroke-width="3.5"/>
      <path d="M13 44a19 17 0 0 1 38 0v5a6 6 0 0 1-6 6H19a6 6 0 0 1-6-6z" fill="${YAMA}"/>
      ${face(32, 42)}`,
    // 槓鈴
    barbell: `
      <rect x="3" y="29.5" width="58" height="5" rx="2.5" fill="${PAPER}"/>
      <rect x="11" y="11" width="10" height="42" rx="3.5" fill="${MIZU}"/>
      <rect x="43" y="11" width="10" height="42" rx="3.5" fill="${MIZU}"/>
      <rect x="21" y="20" width="6" height="24" rx="2.5" fill="${PAPER}"/>
      <rect x="37" y="20" width="6" height="24" rx="2.5" fill="${PAPER}"/>`,
    // 器械（配重片）
    machine: `
      <rect x="11" y="5" width="42" height="55" rx="7" fill="${PAPER}"/>
      <circle cx="32" cy="14" r="5" fill="${MIZU}"/>
      <path d="M32 19v9"/>
      <rect x="20" y="28" width="24" height="7" rx="2.5" fill="${WAKA}"/>
      <rect x="20" y="35" width="24" height="7" rx="2.5" fill="${WAKA}"/>
      <rect x="20" y="42" width="24" height="7" rx="2.5" fill="${WAKA}"/>
      <rect x="20" y="49" width="24" height="6" rx="2.5" fill="${WAKA}"/>
      <path d="M44 38.5h5" stroke-width="2.5"/>
      <circle cx="50" cy="38.5" r="2.6" fill="${CORAL}"/>`,
    // 徒手：在瑜珈墊上舉手的小糰子
    body: `
      <rect x="6" y="51" width="52" height="8" rx="4" fill="${CORAL}"/>
      <path d="M21 33L11 21M43 33l10-12"/>
      <circle cx="32" cy="36" r="15" fill="${WAKA}"/>
      ${face(32, 35)}
      <path d="M52 29q3.5 4.5 0 7q-3.5-2.5 0-7z" fill="${MIZU}" stroke-width="2"/>`,
    // 引體向上：掛在單槓上的小糰子
    pullup: `
      <path d="M4 11h56" stroke-width="5"/>
      <path d="M25 33L22 12M39 33l3-21"/>
      <circle cx="22" cy="12" r="3.5" fill="${PAPER}"/>
      <circle cx="42" cy="12" r="3.5" fill="${PAPER}"/>
      <circle cx="32" cy="41" r="15" fill="${CORAL}"/>
      ${face(32, 40, YAMA)}`,
    // 椅凳（保加利亞分腿蹲、胸推）
    bench: `
      <path d="M17 38v18M47 38v18M13 56h8M43 56h8" />
      <rect x="6" y="30" width="52" height="10" rx="5" fill="${MIZU}"/>
      <rect x="40" y="16" width="16" height="11" rx="4" fill="${CORAL}"/>
      <rect x="26" y="18" width="16" height="7" rx="3" fill="${PAPER}"/>
      <rect x="8" y="16" width="16" height="11" rx="4" fill="${CORAL}"/>`,
    // 打勾
    check: `<path d="M14 33l11 11 25-26" fill="none" stroke-width="6"/>`,
  };

  // 動作 → 插圖
  const BY_ID = { pullup: 'pullup', bss: 'bench', dbpress: 'bench', incline: 'bench', lpd: 'machine', seatrow: 'machine', singlerow: 'machine' };
  const BY_EQUIP = { 啞鈴: 'dumbbell', 壺鈴: 'kettlebell', 槓: 'barbell', 器械: 'machine', 徒手: 'body' };

  let n = 0;
  window.illo = (key, anim = true) => {
    // 每個插圖錯開一點節奏，看起來比較自然
    const delay = anim ? ` style="animation-delay:-${(n++ * 0.7) % 3.2}s"` : '';
    return `<svg class="${anim ? 'illo' : ''}" viewBox="0 0 64 64" aria-hidden="true"${delay}
      fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${ART[key]}</svg>`;
  };
  window.illoFor = ex => window.illo(BY_ID[ex.id] || BY_EQUIP[ex.equip] || 'body');
})();
