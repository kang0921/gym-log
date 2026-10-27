// 動作分解圖：用關節位置畫出繪本風的小人，兩個姿勢之間用 SMIL 動畫來回
// 畫布 120×100，地板 y=92，側面朝右
(() => {
  const INK = '#3E3A39', CORAL = '#F2A497', YAMA = '#F6D27A', MIZU = '#A8D3E6', WAKA = '#B9DAA5', PAPER = '#FFFCF6';
  const FLOOR = 92, FY = 88.5; // FY：腳踝落地時的高度
  const LEN = { torso: 24, neck: 10, ua: 13, fa: 12, th: 17, sh: 17 };

  const rad = a => a * Math.PI / 180;
  const dir = (a, l = 1) => [Math.cos(rad(a)) * l, Math.sin(rad(a)) * l];
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  const f1 = n => Math.round(n * 10) / 10;

  // 四肢：陣列 = [上段角度, 下段角度, 腳掌角度]；物件 = 用 at／rel 指定末端位置，bend 決定關節往哪彎
  function limb(base, spec, l1, l2, origin) {
    if (Array.isArray(spec)) {
      const j = add(base, dir(spec[0], l1));
      return { j, e: add(j, dir(spec[1], l2)), foot: spec[2] };
    }
    const t = spec.rel ? add(origin, spec.rel) : spec.at;
    const dx = t[0] - base[0], dy = t[1] - base[1];
    const a = Math.atan2(dy, dx) * 180 / Math.PI;
    const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
    const al = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)) * 180 / Math.PI;
    const c1 = add(base, dir(a + al, l1)), c2 = add(base, dir(a - al, l1));
    const better = { f: (p, q) => p[0] > q[0], b: (p, q) => p[0] < q[0], u: (p, q) => p[1] < q[1], d: (p, q) => p[1] > q[1] }[spec.bend || 'f'];
    return { j: better(c1, c2) ? c1 : c2, e: add(base, dir(a, d)), foot: spec.foot };
  }

  // 正面視角時，沒寫的另一邊自動左右對稱
  function mirror(spec, cx) {
    if (!spec) return spec;
    if (Array.isArray(spec)) return spec.map((a, i) => i < 2 ? 180 - a : a == null ? a : 180 - a);
    const m = { ...spec, bend: { f: 'b', b: 'f' }[spec.bend || 'f'] || spec.bend };
    if (spec.rel) m.rel = [-spec.rel[0], spec.rel[1]];
    if (spec.at) m.at = [2 * cx - spec.at[0], spec.at[1]];
    return m;
  }

  function solve(p, front) {
    const P = p.p, t = p.t ?? -90;
    const L = { ...LEN, ...(p.L || {}) };
    const N = add(P, dir(t, L.torso));
    const H = add(N, dir(t, L.neck));
    const sx = front ? 7 : 0, hx = front ? 5 : 0;
    const an = p.an, ln = p.ln;
    const af = p.af || (front ? mirror(an, P[0]) : an);
    const lf = p.lf || (front ? mirror(ln, P[0]) : ln);
    const s = {
      P, N, H, t, front,
      face: t + (p.flip ? -90 : 90),
      an: limb(add(N, [sx, 0]), an, L.ua, L.fa, N),
      af: limb(add(N, [-sx, 0]), af, L.ua, L.fa, N),
      ln: limb(add(P, [hx, 0]), ln, L.th, L.sh, P),
      lf: limb(add(P, [-hx, 0]), lf, L.th, L.sh, P),
    };
    s.bases = { an: add(N, [sx, 0]), af: add(N, [-sx, 0]), ln: add(P, [hx, 0]), lf: add(P, [-hx, 0]) };
    return s;
  }

  // ---- 路徑產生器（每一格的指令結構一樣，動畫才能內插） ----
  const circ = (c, r) => `M${f1(c[0] - r)} ${f1(c[1])}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  const line = (...pts) => 'M' + pts.map(p => `${f1(p[0])} ${f1(p[1])}`).join('L');

  function limbPath(s, k) {
    const b = s.bases[k], l = s[k];
    const isLeg = k[0] === 'l';
    const pts = [b, l.j, l.e];
    if (isLeg) {
      const fd = l.foot ?? (s.front ? (k === 'ln' ? 0 : 180) : 0);
      pts.push(add(l.e, dir(fd, s.front ? 3 : 5)));
    }
    return line(...pts);
  }

  // 拿在手上、跟著關節動的道具
  function pointOf(s, key) {
    if (key === 'wn') return s.an.e;
    if (key === 'wf') return s.af.e;
    if (key === 'wm') return [(s.an.e[0] + s.af.e[0]) / 2, (s.an.e[1] + s.af.e[1]) / 2];
    if (key === 'kn') return s.ln.j;
    if (key === 'kf') return s.lf.j;
    if (key === 'fn') return s.ln.e;
    if (key === 'ff') return s.lf.e;
    return s.P;
  }
  const PROP = {
    db: (pt) => [{ d: circ(pt, 4.3), fill: CORAL }],
    kb: (pt) => [
      { d: `M${f1(pt[0] - 4)} ${f1(pt[1] + 4)}Q${f1(pt[0])} ${f1(pt[1] - 3)} ${f1(pt[0] + 4)} ${f1(pt[1] + 4)}`, fill: 'none', w: 2.5 },
      { d: circ([pt[0], pt[1] + 8], 5.5), fill: YAMA },
    ],
    bar: (pt) => [{ d: circ(pt, 8.5), fill: MIZU }, { d: circ(pt, 2.2), fill: PAPER, w: 2 }],
    knob: (pt) => [{ d: circ(pt, 3), fill: MIZU, w: 2.5 }],
    pad: (pt) => [{ d: circ(pt, 4), fill: YAMA, w: 2.5 }],
    kneepad: (pt) => [{ d: circ([pt[0], pt[1] + 5.5], 4.5), fill: WAKA, w: 2.5 }],
  };

  // ---- 固定不動的器材 ----
  const S = {
    floor: () => `<path d="M6 ${FLOOR}H114" stroke-width="2.5"/>`,
    bench: (x1, x2, y, c = MIZU) => `<path d="M${x1 + 5} ${y + 5}V${FLOOR}M${x2 - 5} ${y + 5}V${FLOOR}" stroke-width="2.5"/>
      <rect x="${x1}" y="${y}" width="${x2 - x1}" height="6" rx="3" fill="${c}"/>`,
    back: (x, y1, y2) => `<rect x="${x}" y="${y1}" width="5" height="${y2 - y1}" rx="2.5" fill="${MIZU}"/>`,
    box: (x, y, w) => `<rect x="${x}" y="${y}" width="${w}" height="${FLOOR - y}" rx="3" fill="${YAMA}"/>`,
    pullbar: (y) => `<path d="M34 ${y}V${FLOOR}M88 ${y}V${FLOOR}" stroke-width="2.5"/><path d="M30 ${y}H92" stroke-width="4"/>`,
    pulley: (x, y) => `<circle cx="${x}" cy="${y}" r="3.5" fill="${PAPER}" stroke-width="2.5"/>`,
    rails: (x1, x2) => `<path d="M${x1} 8V${FLOOR}M${x2} 8V${FLOOR}" stroke-width="2" stroke-dasharray="1 4"/>`,
    roller: (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${WAKA}"/>`,
    plate: (x, y1, y2) => `<rect x="${x}" y="${y1}" width="5" height="${y2 - y1}" rx="2.5" fill="${YAMA}"/>`,
    raw: (svg) => svg,
  };

  // ---- 36 個動作的姿勢 ----
  // p：骨盆位置，t：軀幹角度（-90 = 直立），an/af：前／後手，ln/lf：前／後腳
  const hang = { rel: [1, 22] };
  const STAND = { p: [60, 55.5], t: -90, an: hang, ln: { at: [62, FY] } };
  const LUNGE = { p: [56, 70], t: -90, an: hang, ln: { at: [72, FY] }, lf: { at: [34, 85], bend: 'd', foot: 80 } };
  const SEAT = { p: [56, 71], t: -90, ln: [0, 90] };

  const DEFS = {
    // 腿臀
    squat: { stat: [S.bench(28, 48, 77, WAKA)], props: [['db', 'wn']],
      f: [{ ...STAND, an: { rel: [7, 4], bend: 'd' } }, { p: [47, 73], t: -55, an: { rel: [7, 5], bend: 'd' }, ln: { at: [63, FY] } }] },
    thruster: { props: [['db', 'wn'], ['db', 'wf']],
      f: [{ p: [47, 73], t: -55, an: { rel: [5, -1], bend: 'd' }, ln: { at: [63, FY] } }, { ...STAND, an: { rel: [3, -24] } }],
      labels: ['蹲下', '站起推上去'] },
    rlunge: { props: [['db', 'wn'], ['db', 'wf']], f: [STAND, LUNGE], labels: ['站好', '往後踩蹲下'] },
    lunge: { props: [['db', 'wn'], ['db', 'wf']], f: [STAND, LUNGE], labels: ['站好', '跨步蹲下'] },
    wlunge: { props: [['db', 'wn'], ['db', 'wf']],
      f: [{ ...STAND, ln: [0, 90], lf: { at: [60, FY] } }, LUNGE], labels: ['抬腿停一下', '往前踩蹲下'] },
    bss: { stat: [S.bench(12, 40, 76)], props: [['db', 'wn'], ['db', 'wf']],
      f: [{ p: [58, 59], t: -88, an: hang, ln: { at: [72, FY] }, lf: { at: [33, 72], bend: 'd', foot: 190 } },
        { p: [52, 73], t: -82, an: hang, ln: { at: [72, FY] }, lf: { at: [33, 72], bend: 'd', foot: 190 } }] },
    rdl: { props: [['bar', 'wn']],
      f: [{ ...STAND, an: { rel: [3, 23] } }, { p: [50, 60], t: -12, an: { rel: [0, 21] }, ln: { at: [62, FY] } }],
      labels: ['站好', '屁股往後推'] },
    sdl: { props: [['db', 'wn'], ['db', 'wf']],
      f: [{ ...STAND, an: { rel: [3, 23] } }, { p: [52, 57], t: -15, an: { rel: [0, 22] }, ln: { at: [60, FY] } }],
      labels: ['站好', '膝蓋微彎往下'] },
    kbdl: { props: [['kb', 'wn']],
      f: [{ p: [50, 70], t: -48, an: { at: [66, 77] }, ln: { at: [64, FY] } }, { ...STAND, an: { rel: [3, 22] } }],
      labels: ['抓好壺鈴', '用髖站起來'] },
    sumo: { front: true, props: [['kb', 'wm']],
      f: [{ p: [60, 76], t: -90, an: { at: [63, 82] }, ln: { at: [80, FY] } }, { p: [60, 57], t: -90, an: { at: [63, 82] }, ln: { at: [80, FY] } }],
      labels: ['腳尖朝外蹲低', '站起來'] },
    swing: { props: [['kb', 'wn']],
      f: [{ p: [50, 63], t: -25, an: { at: [56, 80] }, ln: { at: [62, FY] }, lf: { at: [57, FY] } },
        { ...STAND, an: { rel: [24, 2] } }],
      labels: ['屁股往後', '髖往前頂甩上來'] },
    stepup: { stat: [S.box(66, 82, 32)],
      f: [{ p: [48, 55.5], t: -90, an: hang, lf: { at: [50, FY] }, ln: { at: [75, 78.5], bend: 'u' } },
        { p: [74, 46], t: -90, an: hang, ln: { at: [76, 78.5] }, lf: { at: [70, 72] } }],
      labels: ['一腳踩上去', '踩直站上去'] },
    hamcurl: { stat: [S.bench(30, 62, 75), S.back(28, 42, 75), S.raw(`<circle cx="62" cy="60" r="4" fill="${YAMA}" stroke-width="2.5"/>`)], props: [['pad', 'fn'], ['pad', 'ff']],
      f: [{ ...SEAT, p: [46, 70], t: -95, an: { at: [58, 74], bend: 'd' }, ln: [2, 12] },
        { ...SEAT, p: [46, 70], t: -95, an: { at: [58, 74], bend: 'd' }, ln: [2, 108] }],
      labels: ['腿伸直', '往下勾'] },
    legext: { stat: [S.bench(30, 62, 75), S.back(28, 42, 75)], props: [['pad', 'fn'], ['pad', 'ff']],
      f: [{ ...SEAT, p: [46, 70], t: -95, an: { at: [58, 74], bend: 'd' }, ln: [2, 92] },
        { ...SEAT, p: [46, 70], t: -95, an: { at: [58, 74], bend: 'd' }, ln: [0, -4] }],
      labels: ['小腿垂下', '把腿伸直'] },
    abd: { front: true, stat: [S.bench(36, 84, 70)], props: [['pad', 'kn', [5, 0]], ['pad', 'kf', [-5, 0]]],
      f: [{ p: [60, 66], t: -90, L: { th: 8 }, an: { at: [76, 68] }, ln: [80, 90] },
        { p: [60, 66], t: -90, L: { th: 8 }, an: { at: [76, 68] }, ln: [15, 95] }],
      labels: ['膝蓋併攏', '往外推開'] },
    add: { front: true, stat: [S.bench(36, 84, 70)], props: [['pad', 'kn', [-4, 0]], ['pad', 'kf', [4, 0]]],
      f: [{ p: [60, 66], t: -90, L: { th: 8 }, an: { at: [76, 68] }, ln: [15, 95] },
        { p: [60, 66], t: -90, L: { th: 8 }, an: { at: [76, 68] }, ln: [80, 90] }],
      labels: ['膝蓋打開', '快速夾緊'] },
    hipext: { stat: [S.raw(`<path d="M62 56L74 ${FLOOR}M34 78L30 ${FLOOR}" stroke-width="2.5"/><rect x="54" y="48" width="18" height="8" rx="4" fill="${MIZU}" transform="rotate(-56 63 52)"/><rect x="27" y="72" width="14" height="6" rx="3" fill="${YAMA}" transform="rotate(-56 34 75)"/>`)],
      f: [{ p: [58, 46], t: 80, an: { rel: [-4, 5], bend: 'd' }, ln: { at: [38, 74], foot: 214 } },
        { p: [58, 46], t: -56, an: { rel: [5, 5], bend: 'd' }, ln: { at: [38, 74], foot: 214 } }],
      labels: ['身體往下彎', '用屁股抬起來'] },

    // 背
    pullup: { stat: [S.pullbar(17)], props: [['kneepad', 'kn']],
      f: [{ p: [60, 62], t: -90, an: { at: [64, 17] }, af: { at: [58, 17] }, ln: [92, 170] },
        { p: [60, 46], t: -90, an: { at: [64, 17], bend: 'd' }, af: { at: [58, 17], bend: 'd' }, ln: [92, 170] }],
      labels: ['手伸直吊著', '手肘往下拉'] },
    lpd: { stat: [S.bench(34, 62, 75), S.pulley(64, 6), S.raw(`<circle cx="66" cy="62" r="4" fill="${YAMA}" stroke-width="2.5"/>`)],
      props: [['cable', 'wn', [64, 6]], ['knob', 'wn']],
      f: [{ ...SEAT, p: [48, 71], t: -92, an: { at: [62, 14] } }, { ...SEAT, p: [48, 71], t: -100, an: { rel: [8, 3], bend: 'd' } }],
      labels: ['手伸直握桿', '拉到上胸'] },
    seatrow: { stat: [S.bench(26, 56, 77), S.plate(80, 64, 92), S.pulley(106, 62)], props: [['cable', 'wn', [106, 62]], ['knob', 'wn']],
      f: [{ p: [44, 73], t: -72, an: { at: [88, 62] }, ln: { at: [78, 76], bend: 'u' } },
        { p: [44, 73], t: -95, an: { rel: [9, 14], bend: 'b' }, ln: { at: [78, 76], bend: 'u' } }],
      labels: ['手往前伸', '手肘往後拉'] },
    singlerow: { stat: [S.bench(26, 56, 77), S.plate(80, 64, 92), S.pulley(106, 62)], props: [['cable', 'wn', [106, 62]], ['knob', 'wn']],
      f: [{ p: [44, 73], t: -72, an: { at: [88, 62] }, af: { rel: [14, 18] }, ln: { at: [78, 76], bend: 'u' } },
        { p: [44, 73], t: -92, an: { rel: [-1, 14], bend: 'b' }, af: { rel: [14, 18] }, ln: { at: [78, 76], bend: 'u' } }],
      labels: ['單手往前伸', '單手往後拉'] },
    dbrow: { stat: [S.bench(72, 106, 64)], props: [['db', 'wn']],
      f: [{ p: [46, 56], t: -12, an: { rel: [0, 22] }, af: { at: [84, 61] }, ln: { at: [56, FY] }, lf: { at: [36, FY] } },
        { p: [46, 56], t: -12, an: { rel: [-9, 4], bend: 'u' }, af: { at: [84, 61] }, ln: { at: [56, FY] }, lf: { at: [36, FY] } }],
      labels: ['手臂垂下', '用背拉上來'] },

    // 胸
    dbpress: { stat: [S.bench(22, 86, 68)], props: [['db', 'wn'], ['db', 'wf']],
      f: [{ p: [72, 63], t: 180, an: { rel: [0, -24] }, ln: { at: [84, FY], bend: 'u' } },
        { p: [72, 63], t: 180, an: { rel: [2, -6], bend: 'd' }, ln: { at: [84, FY], bend: 'u' } }],
      labels: ['推到上面', '慢慢放到胸線'] },
    incline: { stat: [S.raw(`<path d="M50 66L58 ${FLOOR}M78 77V${FLOOR}" stroke-width="2.5"/><path d="M42 57L68 72H84" stroke-width="7" stroke-linecap="round"/><path d="M42 57L68 72H84" stroke="${MIZU}" stroke-width="3" stroke-linecap="round"/>`)],
      props: [['db', 'wn'], ['db', 'wf']],
      f: [{ p: [70, 66], t: -150, an: { rel: [6, -23] }, ln: { at: [86, FY], bend: 'u' } },
        { p: [70, 66], t: -150, an: { rel: [4, -6], bend: 'd' }, ln: { at: [86, FY], bend: 'u' } }],
      labels: ['推到上面', '慢慢放下'] },
    machpress: { stat: [S.bench(30, 60, 75), S.back(28, 36, 75)], props: [['knob', 'wn']],
      f: [{ ...SEAT, p: [42, 71], t: -92, an: { rel: [9, 6], bend: 'd' } }, { ...SEAT, p: [42, 71], t: -92, an: { rel: [24, 4] } }],
      labels: ['握把在胸前', '往前推'] },

    // 肩
    dbshoulder: { stat: [S.bench(42, 70, 75)], props: [['db', 'wn'], ['db', 'wf']],
      f: [{ ...SEAT, an: { rel: [4, -2], bend: 'd' } }, { ...SEAT, an: { rel: [2, -24] } }],
      labels: ['啞鈴在肩膀旁', '往上推'] },
    machshoulder: { stat: [S.bench(42, 70, 75), S.back(40, 30, 75)], props: [['knob', 'wn']],
      f: [{ ...SEAT, an: { rel: [4, -2], bend: 'd' } }, { ...SEAT, an: { rel: [2, -24] } }],
      labels: ['握把在肩膀旁', '往上推'] },
    smith: { stat: [S.rails(70, 74), S.bench(42, 70, 75)], props: [['knob', 'wn']],
      f: [{ ...SEAT, an: { rel: [5, -2], bend: 'd' } }, { ...SEAT, an: { rel: [3, -24] } }],
      labels: ['槓在下巴前', '往上推'] },
    lungepress: { props: [['db', 'wn'], ['db', 'wf']],
      f: [{ ...LUNGE, an: { rel: [4, -2], bend: 'd' } }, { ...LUNGE, an: { rel: [2, -24] } }],
      labels: ['弓步，啞鈴在肩', '往上推'] },
    lateral: { front: true, props: [['db', 'wn'], ['db', 'wf']],
      f: [{ ...STAND, ln: { at: [70, FY] }, an: { rel: [12, 22] } }, { ...STAND, ln: { at: [70, FY] }, an: { rel: [31, 3] } }],
      labels: ['手在身體兩側', '往兩側舉到肩高'] },
    reardelt: { props: [['db', 'wn'], ['db', 'wf']],
      f: [{ p: [50, 60], t: -12, an: { rel: [0, 20] }, ln: { at: [62, FY] } }, { p: [50, 60], t: -12, an: { rel: [-4, 5], bend: 'u' }, ln: { at: [62, FY] } }],
      labels: ['彎腰，手垂下', '往兩側打開'] },

    // 核心
    crunchm: { stat: [S.bench(42, 70, 75)], props: [['knob', 'wn']],
      f: [{ ...SEAT, t: -95, an: { rel: [5, -5], bend: 'd' } }, { ...SEAT, t: -45, an: { rel: [8, 2], bend: 'd' } }],
      labels: ['坐直', '捲起來'] },
    romancrunch: { stat: [S.raw(`<rect x="50" y="68" width="22" height="7" rx="3.5" fill="${MIZU}"/><path d="M61 75V${FLOOR}M90 66V${FLOOR}" stroke-width="2.5"/>`), S.roller(89, 57, 4)],
      f: [{ p: [60, 64], t: 190, an: { rel: [2, -6], bend: 'u' }, ln: { at: [86, 63], bend: 'u' } },
        { p: [60, 64], t: -60, an: { rel: [6, 4], bend: 'd' }, ln: { at: [86, 63], bend: 'u' } }],
      labels: ['往後躺', '捲腹坐起'] },
    birddog: { f: [{ p: [44, 71], t: -15, an: { at: [68, FY] }, ln: { at: [26, FY], bend: 'd', foot: 180 } },
      { p: [44, 71], t: -15, an: [-8, -8], af: { at: [68, FY] }, ln: { at: [26, FY], bend: 'd', foot: 180 }, lf: [172, 176, 176] }],
      labels: ['四足跪姿', '對側手腳伸直'] },
    climber: { f: [{ p: [44, 70], t: -14, an: { at: [68, FY] }, ln: { at: [18, 86], foot: 80 } },
      { p: [44, 70], t: -14, an: { at: [68, FY] }, ln: { at: [56, 82] }, lf: { at: [18, 86], foot: 80 } }],
      labels: ['棒式撐好', '膝蓋往胸口帶'] },
    thoracic: { stat: [S.roller(40, 84, 7)],
      f: [{ p: [66, 84], t: -172, an: { rel: [-8, -3], bend: 'u' }, ln: { at: [88, FY], bend: 'u' } },
        { p: [66, 84], t: 178, an: { rel: [-9, 1], bend: 'u' }, ln: { at: [88, FY], bend: 'u' } }],
      labels: ['上背靠滾筒', '往後延伸'] },
  };

  // ---- 畫出來 ----
  function shapes(def) {
    const sol = def.f.map(fr => solve(fr, def.front));
    const out = { far: [], body: [], near: [] };
    const push = (grp, fn, attrs) => out[grp].push({ ds: sol.map(fn), ...attrs });
    const limbShapes = (grp, k, w, color) => {
      push(grp, s => limbPath(s, k), { stroke: INK, w: w + 5 });
      push(grp, s => limbPath(s, k), { stroke: color, w });
    };
    const propShapes = (grp, side) => (def.props || []).forEach(([type, key, extra]) => {
      if ((side === 'far') !== (key.endsWith('f'))) return;
      if (type === 'cable') { push(grp, s => line(extra, pointOf(s, key)), { stroke: INK, w: 2 }); return; }
      PROP[type](pointOf(sol[0], key)).forEach((_, i) => {
        push(grp, s => { let pt = pointOf(s, key); if (extra) pt = add(pt, extra); return PROP[type](pt)[i].d; },
          { fill: PROP[type](pointOf(sol[0], key))[i].fill, stroke: INK, w: PROP[type](pointOf(sol[0], key))[i].w || 3 });
      });
    });

    const front = def.front;
    // 後面那一側
    limbShapes(front ? 'body' : 'far', 'lf', 7, MIZU);
    if (!front) { limbShapes('far', 'af', 6, PAPER); propShapes('far', 'far'); }
    if (front) limbShapes('body', 'ln', 7, MIZU);
    // 身體
    const tw = front ? 15 : 11;
    push('body', s => line(s.P, s.N), { stroke: INK, w: tw + 5 });
    push('body', s => line(s.P, s.N), { stroke: CORAL, w: tw });
    if (!front) limbShapes('body', 'ln', 7, MIZU);
    // 頭
    push('body', s => circ(add(s.H, front ? dir(s.t, 8) : add(dir(s.face + 180, 6.5), dir(s.t, 3))), 3.6), { fill: INK, stroke: INK, w: 1 });
    push('body', s => circ(s.H, 8), { fill: PAPER, stroke: INK, w: 2.8 });
    if (front) {
      [-1, 1].forEach(k => {
        push('body', s => circ(add(add(s.H, [5 * k, 0]), dir(s.t, -2)), 1.7), { fill: CORAL, stroke: 'none' });
        push('body', s => circ(add(add(s.H, [3 * k, 0]), dir(s.t, 1)), 1.3), { fill: INK, stroke: 'none' });
      });
    } else {
      push('body', s => circ(add(add(s.H, dir(s.face, 2.4)), dir(s.t, -2.2)), 1.8), { fill: CORAL, stroke: 'none' });
      push('body', s => circ(add(add(s.H, dir(s.face, 3.8)), dir(s.t, 1.2)), 1.3), { fill: INK, stroke: 'none' });
    }
    // 前面那一側
    if (front) { limbShapes('near', 'af', 6, PAPER); propShapes('near', 'far'); }
    limbShapes('near', 'an', 6, PAPER);
    propShapes('near', 'near');
    return out;
  }

  const KS = '0.45 0 0.55 1;0.45 0 0.55 1';
  function draw(sh, mode) {
    const attrs = x => `fill="${x.fill || 'none'}" stroke="${x.stroke}" stroke-width="${x.w ?? 0}"`;
    if (mode === 'anim') {
      return `<path d="${sh.ds[0]}" ${attrs(sh)}><animate attributeName="d" dur="2.6s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="${KS}" values="${sh.ds[0]};${sh.ds[1]};${sh.ds[0]}"/></path>`;
    }
    return `<path d="${sh.ds[mode]}" ${attrs(sh)}/>`;
  }

  window.POSE_IDS = Object.keys(DEFS);
  window.poseLabels = id => DEFS[id]?.labels || ['預備', '動作'];
  // mode：'anim' 動畫，0／1 第幾格
  window.poseSVG = (id, mode = 'anim') => {
    const def = DEFS[id];
    if (!def) return '';
    const sh = shapes(def);
    const g = list => list.map(x => draw(x, mode)).join('');
    return `<svg class="pose" viewBox="0 0 120 100" role="img" aria-label="${mode === 'anim' ? '動作示範動畫' : '分解圖'}"
      fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      ${S.floor()}${(def.stat || []).join('')}
      ${def.front ? '' : `<g transform="translate(-3 0)">${g(sh.far)}</g>`}
      ${g(sh.body)}${g(sh.near)}
    </svg>`;
  };
})();
