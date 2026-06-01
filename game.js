'use strict';
// ════════════════════════════════════════════════════════════
//  星際大富翁 — 外星地產棋盤遊戲
// ════════════════════════════════════════════════════════════

const DICE_EMOJI = ['⚀','⚁','⚂','⚃','⚄','⚅'];
const BET_LEVELS = [10, 25, 50, 100, 200, 500];
const MAX_HOUSE_LEVEL = 5;

const SPACES = [
  { id:0,  name:'GO BASE',     type:'start',   icon:'✦', bg:'#1e0e00', bdr:'#ffd600' },
  { id:1,  name:'Meteor',      type:'prize',   icon:'◆', mult:1, bg:'#001e0e' },
  { id:2,  name:'Crystal Apt', type:'prize',   icon:'◆', mult:3, bg:'#000e28' },
  { id:3,  name:'Fate Card',   type:'random',  icon:'◈', bg:'#140030' },
  { id:4,  name:'Space Tax',   type:'danger',  icon:'✕', pen:1,  bg:'#1e0000' },
  { id:5,  name:'Alien Mall',  type:'prize',   icon:'◆', mult:2, bg:'#001e0e' },
  { id:6,  name:'Supernova',   type:'prize',   icon:'◆', mult:5, bg:'#1e1000' },
  { id:7,  name:'Repair Fee',  type:'danger',  icon:'✕', pen:2,  bg:'#1e0000' },
  { id:8,  name:'Dark Matter', type:'prize',   icon:'◆', mult:3, bg:'#0a0022' },
  { id:9,  name:'Orbit Villa', type:'prize',   icon:'◆', mult:1, bg:'#001e0e' },
  { id:10, name:'NEXUS',       type:'jackpot', icon:'★', mult:12, bg:'#200010', bdr:'#ff6d00' },
  { id:11, name:'Fate Card',   type:'random',  icon:'◈', bg:'#140030' },
  { id:12, name:'Zero Crisis', type:'danger',  icon:'⊗', pen:1, wipePot:true, bg:'#1e0000' },
  { id:13, name:'Ancient City',type:'prize',   icon:'◆', mult:3, bg:'#001e0e' },
  { id:14, name:'Rocket Hub',  type:'prize',   icon:'◆', mult:4, bg:'#1e1000' },
  { id:15, name:'Moon Lodge',  type:'prize',   icon:'◆', mult:1, bg:'#001e0e' },
];

const SPACE_THEME = {
  start:   { edge:'#ffd76a', glow:'255,215,106', fillA:'#2a1b05', fillB:'#090e18', label:'GO' },
  prize:   { edge:'#3cffb0', glow:'60,255,176',  fillA:'#082419', fillB:'#07111e', label:'RENT' },
  random:  { edge:'#b985ff', glow:'185,133,255', fillA:'#20103d', fillB:'#090d1b', label:'CARD' },
  danger:  { edge:'#ff3f64', glow:'255,63,100',  fillA:'#2b0712', fillB:'#0b0b15', label:'TAX' },
  jackpot: { edge:'#ff9f2f', glow:'255,159,47',  fillA:'#331006', fillB:'#140816', label:'LAND' },
};

// 格子在 5×5 網格中的位置
function spaceGrid(id) {
  if (id <= 4)  return [id, 0];
  if (id <= 7)  return [4, id - 4];
  if (id <= 12) return [12 - id, 4];
  return [0, 16 - id];
}

// ── 遊戲狀態 ──────────────────────────────────────────────────
const G = {
  balance: 1000, pot: 0, betIdx: 2,
  position: 0, laps: 0,
  canCashOut: false, animating: false, totalWon: 0,
  houseLevels: Array(16).fill(0),
};

// ── 特效狀態 ──────────────────────────────────────────────────
const PS = [];       // 粒子: {x,y,vx,vy,r,color,alpha,decay,grav}
const FT = [];       // 浮動文字: {x,y,text,color,alpha}
let   BT = null;     // 大字幕: {text,color,alpha,age,dur}
let   FX = null;     // 畫面聚光: {x,y,color,alpha,decay,r}

// 星空背景（固定點位）
const STARS = Array.from({length:60}, () => ({
  fx: Math.random(), fy: Math.random(),
  r:  0.25 + Math.random() * 1.1,
  ph: Math.random() * Math.PI * 2,
  sp: 0.4 + Math.random() * 1.8,
}));

// ── Canvas ────────────────────────────────────────────────────
let canvas, ctx, BS, CS;
let lastDraw = 0;

window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('board');
  ctx    = canvas.getContext('2d');

  resizeBoard();
  window.addEventListener('resize', () => { resizeBoard(); });

  document.getElementById('bet-dn').addEventListener('click', () => adjustBet(-1));
  document.getElementById('bet-up').addEventListener('click', () => adjustBet(+1));
  document.getElementById('roll-btn').addEventListener('click', onRoll);
  document.getElementById('cash-btn').addEventListener('click', onCashOut);
  document.getElementById('over-restart').addEventListener('click', restart);


  updateHUD();
  requestAnimationFrame(loop);
});

function resizeBoard() {
  const wrap = document.getElementById('board-wrap');
  const st = getComputedStyle(wrap);
  const padX = parseFloat(st.paddingLeft) + parseFloat(st.paddingRight);
  const padY = parseFloat(st.paddingTop) + parseFloat(st.paddingBottom);
  const sz   = Math.max(240, Math.min(wrap.clientWidth - padX, wrap.clientHeight - padY) - 4);
  BS = sz; CS = sz / 5;
  canvas.width = sz; canvas.height = sz;
}

// ── 動畫主迴圈（~36fps）────────────────────────────────────────
function loop(ts) {
  requestAnimationFrame(loop);
  if (ts - lastDraw < 27) return;
  lastDraw = ts;

  // 圈數越高，中央面板自動噴出環境火花
  if (G.laps >= 2 && Math.random() < 0.12 + G.laps * 0.06) {
    const lc = lapColor(G.laps);
    PS.push({
      x: CS + CS * 0.3 + Math.random() * CS * 2.4,
      y: CS + CS * 0.3 + Math.random() * CS * 2.4,
      vx: (Math.random() - 0.5) * 0.9,
      vy: -0.4 - Math.random() * 1.8,
      r:  0.6 + Math.random() * 1.4,
      color: lc, alpha: 0.75, decay: 0.022, grav: 0,
    });
  }

  // 更新粒子
  for (let i = PS.length - 1; i >= 0; i--) {
    const p = PS[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += p.grav || 0.09;
    p.alpha -= p.decay;
    if (p.alpha <= 0) PS.splice(i, 1);
  }

  // 更新浮動文字
  for (let i = FT.length - 1; i >= 0; i--) {
    FT[i].y -= 1.3;
    FT[i].alpha -= 0.017;
    if (FT[i].alpha <= 0) FT.splice(i, 1);
  }

  if (FX) {
    FX.alpha -= FX.decay;
    if (FX.alpha <= 0) FX = null;
  }

  // 更新大字幕
  if (BT) {
    BT.age += 27;
    BT.alpha = BT.age < 300 ? BT.age / 300
             : BT.age > BT.dur - 500 ? Math.max(0, (BT.dur - BT.age) / 500)
             : 1;
    if (BT.age >= BT.dur) BT = null;
  }

  draw();
}

// ── 主繪製 ────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, BS, BS);

  // 棋盤機台背景
  const bg = ctx.createLinearGradient(0, 0, BS, BS);
  bg.addColorStop(0, '#101b32');
  bg.addColorStop(0.42, '#050916');
  bg.addColorStop(1, '#020309');
  rrFill(0, 0, BS, BS, 16, bg);

  drawBoardChrome();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.055)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CS, 0);
    ctx.lineTo(i * CS, BS);
    ctx.moveTo(0, i * CS);
    ctx.lineTo(BS, i * CS);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,215,106,0.24)';
  ctx.lineWidth = Math.max(2, CS * 0.018);
  ctx.shadowColor = 'rgba(57,216,255,0.25)';
  ctx.shadowBlur = 18;
  rrStroke(2, 2, BS - 4, BS - 4, 16);
  ctx.restore();

  // 先畫非底排格子，再畫中央面板，最後畫底排
  // 底排格子後畫，房屋高度超出時才不會被中央面板遮住
  SPACES.filter(sp => spaceGrid(sp.id)[1] < 4).forEach(drawCell);
  drawCenter();
  SPACES.filter(sp => spaceGrid(sp.id)[1] === 4).forEach(drawCell);

  // 繪製特效（疊加在最上層）
  drawSpotlight();
  drawParticles();
  drawFloatTexts();
  drawBigText();
}

function drawBoardChrome() {
  const now = Date.now();
  const pulse = 0.45 + 0.55 * Math.sin(now * 0.0024);

  ctx.save();
  const bezel = ctx.createLinearGradient(0, 0, BS, BS);
  bezel.addColorStop(0, 'rgba(255,255,255,0.16)');
  bezel.addColorStop(0.18, 'rgba(255,215,106,0.10)');
  bezel.addColorStop(0.52, 'rgba(2,4,10,0.28)');
  bezel.addColorStop(1, 'rgba(57,216,255,0.14)');
  ctx.strokeStyle = bezel;
  ctx.lineWidth = Math.max(7, CS * 0.06);
  rrStroke(5, 5, BS - 10, BS - 10, 18);

  ctx.strokeStyle = `rgba(255,215,106,${0.16 + pulse * 0.10})`;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([CS * 0.12, CS * 0.08]);
  rrStroke(CS * 0.11, CS * 0.11, BS - CS * 0.22, BS - CS * 0.22, 14);
  ctx.setLineDash([]);

  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2 + now * 0.0005;
    const x = BS / 2 + Math.cos(a) * (BS * 0.485);
    const y = BS / 2 + Math.sin(a) * (BS * 0.485);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.3, CS * 0.018), 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? `rgba(57,216,255,${0.16 + pulse * 0.15})` : `rgba(255,215,106,${0.18 + pulse * 0.18})`;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 6;
    ctx.fill();
  }
  ctx.restore();
}

// ── 繪製格子 ──────────────────────────────────────────────────
function drawCell(sp) {
  const [col, row] = spaceGrid(sp.id);
  const x = col * CS, y = row * CS, pd = Math.max(4, CS * 0.055);
  const now = Date.now();
  const th = SPACE_THEME[sp.type];
  const w = CS - pd * 2;
  const h = CS - pd * 2;
  const rx = x + pd;
  const ry = y + pd;
  const pulse = 0.45 + 0.55 * Math.sin(now * (sp.type === 'jackpot' ? 0.005 : 0.0025) + sp.id);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.68)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 7;
  rrFill(rx + CS * 0.035, ry + CS * 0.045, w, h, 11, '#02040b');
  ctx.restore();

  // 2.5D 地塊厚度，不扭曲文字與房屋本體
  const depth = CS * 0.055;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath();
  ctx.moveTo(rx + 10, ry + h);
  ctx.lineTo(rx + w, ry + h);
  ctx.lineTo(rx + w + depth, ry + h + depth);
  ctx.lineTo(rx + 10 + depth, ry + h + depth);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(${th.glow},0.10)`;
  ctx.beginPath();
  ctx.moveTo(rx + w, ry + 10);
  ctx.lineTo(rx + w, ry + h);
  ctx.lineTo(rx + w + depth, ry + h + depth);
  ctx.lineTo(rx + w + depth, ry + 10 + depth);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  rrPath(rx, ry, w, h, 10);
  ctx.clip();

  const base = ctx.createLinearGradient(rx, ry, rx + w, ry + h);
  base.addColorStop(0, '#2c394e');
  base.addColorStop(0.08, th.fillA);
  base.addColorStop(0.55, th.fillB);
  base.addColorStop(1, '#02030a');
  ctx.fillStyle = base;
  ctx.fillRect(rx, ry, w, h);

  const shine = ctx.createLinearGradient(rx, ry, rx, ry + h);
  shine.addColorStop(0, 'rgba(255,255,255,0.18)');
  shine.addColorStop(0.28, 'rgba(255,255,255,0.025)');
  shine.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = shine;
  ctx.fillRect(rx, ry, w, h);

  ctx.fillStyle = `rgba(${th.glow},${sp.type === 'jackpot' ? 0.18 + pulse * 0.16 : 0.08})`;
  ctx.beginPath();
  ctx.arc(rx + w * 0.86, ry + h * 0.12, w * 0.58, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(${th.glow},0.09)`;
  ctx.lineWidth = 1;
  for (let yy = ry + h * 0.20; yy < ry + h; yy += Math.max(5, CS * 0.08)) {
    ctx.beginPath();
    ctx.moveTo(rx + w * 0.10, yy);
    ctx.lineTo(rx + w * 0.90, yy);
    ctx.stroke();
  }
  ctx.restore();

  // 動態邊框
  ctx.save();
  ctx.shadowColor = `rgba(${th.glow},${sp.type === 'prize' ? 0.16 : 0.36 + pulse * 0.34})`;
  ctx.shadowBlur = sp.type === 'prize' ? 6 : 12 + pulse * 11;
  ctx.strokeStyle = `rgba(${th.glow},${sp.type === 'prize' ? 0.38 : 0.62 + pulse * 0.26})`;
  ctx.lineWidth = sp.type === 'jackpot' ? 2.5 + pulse * 1.3 : 1.4;
  rrStroke(rx, ry, w, h, 11);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  rrStroke(rx + 1.5, ry + 1.5, w - 3, h - 3, 9);
  ctx.restore();

  // 當前格子高亮
  if (sp.id === G.position) {
    const now   = Date.now();
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.007);

    ctx.save();
    // 外層光暈
    ctx.strokeStyle = `rgba(${th.glow},${0.30 + pulse * 0.35})`;
    ctx.lineWidth   = 6 + pulse * 4;
    ctx.shadowColor = `rgba(${th.glow},0.90)`;
    ctx.shadowBlur  = 20 + pulse * 18;
    rrStroke(rx - 1, ry - 1, w + 2, h + 2, 11);
    // 內層白框
    ctx.strokeStyle = `rgba(255,255,255,${0.72 + pulse * 0.28})`;
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 8;
    rrStroke(rx, ry, w, h, 10);
    ctx.restore();

    // 四角 L 形標記
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = `rgba(${th.glow},1)`;
    ctx.shadowBlur  = 10;
    ctx.lineCap     = 'square';
    const arm = Math.max(6, CS * 0.12);
    const corners = [
      [rx,     ry,      arm, 0,    0,   arm ],
      [rx + w, ry,     -arm, 0,    0,   arm ],
      [rx,     ry + h,  arm, 0,    0,  -arm ],
      [rx + w, ry + h, -arm, 0,    0,  -arm ],
    ];
    corners.forEach(([cx2, cy2, dx1, dy1, dx2, dy2]) => {
      ctx.beginPath();
      ctx.moveTo(cx2 + dx1, cy2);
      ctx.lineTo(cx2, cy2);
      ctx.lineTo(cx2, cy2 + dy2);
      ctx.stroke();
    });
    ctx.restore();
  }

  const cx = x + CS / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // 類型小標
  ctx.save();
  ctx.font = `bold ${CS * 0.075}px 'Courier New',monospace`;
  ctx.fillStyle = `rgba(${th.glow},0.74)`;
  ctx.textAlign = 'left';
  ctx.fillText(th.label, rx + CS * 0.10, ry + CS * 0.14);
  ctx.restore();

  let badgeR = CS * 0.245;
  let badgeY = y + CS * 0.405;

  if (isProperty(sp)) {
    drawHouseLevel(rx, ry, w, h, sp, th);
  } else {
    // 徽章底座，降低 emoji 的突兀感
    ctx.save();
    const badge = ctx.createRadialGradient(cx - badgeR * 0.25, badgeY - badgeR * 0.35, badgeR * 0.1, cx, badgeY, badgeR);
    badge.addColorStop(0, 'rgba(255,255,255,0.34)');
    badge.addColorStop(0.34, `rgba(${th.glow},0.22)`);
    badge.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = badge;
    ctx.shadowColor = `rgba(${th.glow},0.32)`;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx, badgeY, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${th.glow},0.50)`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, badgeY, badgeR * 0.76, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 圖示
    ctx.save();
    ctx.shadowColor = `rgba(${th.glow},0.40)`;
    ctx.shadowBlur = 10;
    ctx.font = `${CS * (sp.type === 'jackpot' ? 0.255 : 0.235)}px serif`;
    ctx.fillStyle = '#fff';
    ctx.fillText(sp.icon, cx, badgeY + CS * 0.005);
    ctx.restore();
  }

  // 名稱：地產格不顯示，銀河地標改用英文標誌名，其餘非地產格保留
  if (sp.type === 'jackpot') {
    ctx.font = `900 ${CS * 0.088}px Impact,'Arial Black',sans-serif`;
    ctx.fillStyle = `rgba(${th.glow},0.92)`;
    ctx.shadowColor = th.edge;
    ctx.shadowBlur = 8;
    ctx.fillText('NEXUS', cx, y + CS * 0.62);
    ctx.shadowBlur = 0;
  } else if (!isProperty(sp)) {
    ctx.font = `bold ${CS * 0.094}px Arial`;
    ctx.fillStyle = 'rgba(236,246,255,.78)';
    ctx.fillText(sp.name, cx, y + CS * 0.70);
  }

  // 倍率標籤
  ctx.font = `bold ${CS * 0.116}px Arial`;
  const tagW = CS * 0.42;
  const tagH = CS * 0.18;
  const tagX = cx - tagW / 2;
  const tagY = y + CS * 0.79;
  const rentMult = propertyMultiplier(sp);
  if (sp.type === 'danger') {
    pill(tagX, tagY, tagW, tagH, th.edge, `-×${sp.pen}`);
  } else if (sp.type === 'random') {
    pill(tagX, tagY, tagW, tagH, th.edge, 'CARD');
  }

  if (sp.type === 'danger') drawHazardStripes(rx, ry, w, h, th, pulse);
  if (sp.type === 'random') drawWarpMark(cx, badgeY, badgeR, th, now);
}

// ── 繪製中央面板 ──────────────────────────────────────────────
function drawCenter() {
  const pd  = Math.max(4, CS * 0.055);
  const ix  = CS + pd, iy = CS + pd;
  const iw  = CS * 3 - pd * 2, ih = CS * 3 - pd * 2;
  const cx  = ix + iw / 2, cy = iy + ih / 2;
  const now = Date.now();
  const lap = G.laps;
  const col = lapColor(lap);
  const rgb = hexToRgb(col);
  const glow = `${rgb.r},${rgb.g},${rgb.b}`;
  const hot = lap >= 4;

  ctx.save();
  ctx.shadowColor = hot ? 'rgba(255,63,100,0.38)' : 'rgba(57,216,255,0.22)';
  ctx.shadowBlur = 22 + lap * 6;
  rrFill(ix - 2, iy - 2, iw + 4, ih + 4, 16, hot ? 'rgba(255,63,100,0.08)' : 'rgba(57,216,255,0.06)');
  ctx.restore();

  // ── 金彩金庫背景 ────────────────────────────────────────────
  ctx.save();
  rrPath(ix, iy, iw, ih, 15);
  ctx.clip();

  const nebula = ctx.createRadialGradient(cx, cy - ih * 0.10, 0, cx, cy, iw * 0.78);
  nebula.addColorStop(0, `rgba(${glow},${hot ? 0.36 : 0.26})`);
  nebula.addColorStop(0.34, hot ? '#321018' : '#101733');
  nebula.addColorStop(1, '#03050d');
  ctx.fillStyle = nebula;
  ctx.fillRect(ix, iy, iw, ih);

  const beam = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih);
  beam.addColorStop(0, 'rgba(255,255,255,0.16)');
  beam.addColorStop(0.24, 'rgba(255,255,255,0.025)');
  beam.addColorStop(0.74, 'rgba(0,0,0,0.08)');
  beam.addColorStop(1, 'rgba(255,255,255,0.06)');
  ctx.fillStyle = beam;
  ctx.fillRect(ix, iy, iw, ih);

  const vaultGlow = ctx.createRadialGradient(cx, cy - CS * 0.10, 0, cx, cy - CS * 0.10, CS * 1.25);
  vaultGlow.addColorStop(0, `rgba(${glow},0.20)`);
  vaultGlow.addColorStop(0.46, 'rgba(255,215,106,0.05)');
  vaultGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = vaultGlow;
  ctx.fillRect(ix, iy, iw, ih);

  // 星空
  const ts = now * 0.001;
  STARS.forEach(s => {
    const sx = ix + s.fx * iw, sy = iy + s.fy * ih;
    const tw = 0.1 + 0.9 * Math.abs(Math.sin(ts * s.sp + s.ph));
    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(190,225,255,${tw * (0.5 + lap * 0.08)})`;
    ctx.fill();
  });

  // ── 雷達脈衝環（持續動態，3 個相位差 120°）─────────────────
  const radarPeriod = 2600;
  for (let p = 0; p < 3; p++) {
    const phase = ((now % radarPeriod) / radarPeriod + p / 3) % 1;
    const ringR  = phase * Math.min(iw, ih) * 0.50;
    const ringA  = (1 - phase) * (phase < 0.08 ? phase / 0.08 : 1) * 0.28;
    ctx.save();
    ctx.strokeStyle = `rgba(${glow},${ringA})`;
    ctx.lineWidth   = 1.2;
    ctx.shadowColor = col;
    ctx.shadowBlur  = 5 * (1 - phase);
    ctx.beginPath();
    ctx.arc(cx, cy - CS * 0.08, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ── 漂浮星塵（22 粒各自以不同速度緩緩上升）─────────────────
  const dustT = now * 0.000022;
  for (let i = 0; i < 22; i++) {
    const seed = i * 2399.3;
    const px   = ix + Math.abs(Math.sin(seed * 0.7)) * iw;
    const py   = iy + ((dustT * (0.3 + Math.abs(Math.sin(seed)) * 0.5) + Math.abs(Math.sin(seed * 1.3))) % 1) * ih;
    const r    = 0.5 + Math.abs(Math.sin(seed * 2.1)) * 1.2;
    const tw   = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.0015 + seed));
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${glow},${0.05 + tw * 0.13})`;
    ctx.fill();
  }

  // ── 雙臂銀河螺旋（極緩旋轉，螺線狀點陣）─────────────────────
  ctx.save();
  ctx.translate(cx, cy - CS * 0.08);
  const galRot = now * 0.000048;
  for (let arm = 0; arm < 2; arm++) {
    ctx.save();
    ctx.rotate(galRot + arm * Math.PI);
    for (let i = 4; i < 52; i++) {
      const t  = i / 52;
      const a  = t * Math.PI * 3.8;
      const sr = t * Math.min(iw, ih) * 0.46;
      const sx = Math.cos(a) * sr;
      const sy = Math.sin(a) * sr * 0.50;
      const alpha = t * (1 - t) * 4 * 0.052 * (0.5 + 0.5 * Math.sin(now * 0.0019 + t * 7));
      ctx.beginPath();
      ctx.arc(sx, sy, 0.7 + t * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${glow},${alpha})`;
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();

  // 內部儀表弧線
  ctx.save();
  ctx.translate(cx, cy - CS * 0.08);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(now * (0.00018 + i * 0.00006));
    ctx.strokeStyle = `rgba(${glow},${0.08 + i * 0.025})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, CS * (0.65 + i * 0.18), Math.PI * 0.08, Math.PI * (0.64 + i * 0.08));
    ctx.stroke();
  }
  ctx.restore();

  // 彩金能量槽
  const meterW = iw * 0.70;
  const meterH = Math.max(7, CS * 0.07);
  const meterX = cx - meterW / 2;
  const meterY = iy + ih - CS * 0.45;
  const meterFill = Math.min(1, (G.pot / Math.max(1, BET_LEVELS[G.betIdx] * 30)) + lap * 0.10);
  rrFill(meterX, meterY, meterW, meterH, meterH / 2, 'rgba(0,0,0,0.38)');
  const mg = ctx.createLinearGradient(meterX, meterY, meterX + meterW, meterY);
  mg.addColorStop(0, '#39d8ff');
  mg.addColorStop(0.48, col);
  mg.addColorStop(1, hot ? '#ff3f64' : '#ffd76a');
  rrFill(meterX + 2, meterY + 2, Math.max(0, (meterW - 4) * meterFill), meterH - 4, meterH / 2, mg);
  ctx.strokeStyle = `rgba(${glow},0.38)`;
  ctx.lineWidth = 1;
  rrStroke(meterX, meterY, meterW, meterH, meterH / 2);

  // 掃描線
  ctx.globalAlpha = 0.055;
  for (let y = iy; y < iy + ih; y += 4) { ctx.fillStyle='#000'; ctx.fillRect(ix,y,iw,1); }
  ctx.globalAlpha = 1;
  ctx.restore();

  // ── 邊框：圈數越高越亮 ──────────────────────────────────────
  const borderPulse = 0.4 + 0.6 * Math.sin(now * (0.002 + lap * 0.001));
  ctx.strokeStyle = `rgba(${glow},${lap === 0 ? 0.26 : 0.58 + borderPulse * 0.28})`;
  ctx.lineWidth   = lap === 0 ? 1.4 : 1.6 + lap * 0.38;
  ctx.shadowColor = col;
  ctx.shadowBlur  = 8 + lap * 8 * borderPulse;
  rrStroke(ix, iy, iw, ih, 15);
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  rrStroke(ix + 2, iy + 2, iw - 4, ih - 4, 12);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // ── 旋轉星門 ───────────────────────────────────────────────
  const rings = lap > 0 ? Math.min(lap + 1, 4) : 1;
  for (let r = 0; r < rings; r++) {
    const rSpeed  = (0.00055 + lap * 0.00024) * (r % 2 === 0 ? 1 : -1);
    const rRadius = CS * (0.70 + r * 0.15);
    const rPulse  = 0.5 + 0.5 * Math.sin(now * 0.004 + r * 1.2);
    ctx.save();
    ctx.translate(cx, cy - CS * 0.10);
    ctx.rotate(now * rSpeed);
    ctx.strokeStyle = `rgba(${glow},${0.20 + rPulse * 0.24})`;
    ctx.lineWidth   = 1 + r * 0.35;
    ctx.setLineDash([8 - r, 11 + r * 2]);
    ctx.shadowColor = col;
    ctx.shadowBlur  = 7 * rPulse;
    ctx.beginPath();
    ctx.ellipse(0, 0, rRadius, rRadius * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  // ── 標題 ────────────────────────────────────────────────────
  ctx.save();
  const marqueeW = CS * 1.68;
  const marqueeH = CS * 0.23;
  rrFill(cx - marqueeW / 2, iy + CS * 0.12, marqueeW, marqueeH, 7, 'rgba(0,0,0,0.38)');
  ctx.strokeStyle = `rgba(${glow},0.34)`;
  ctx.lineWidth = 1;
  rrStroke(cx - marqueeW / 2, iy + CS * 0.12, marqueeW, marqueeH, 7);
  ctx.font      = `bold ${CS * 0.084}px 'Courier New',monospace`;
  ctx.fillStyle = `rgba(${glow},0.82)`;
  ctx.fillText('RENT VAULT', cx, iy + CS * 0.235);
  ctx.restore();

  // ── 獎池金額（每圈放大）────────────────────────────────────
  const potCY   = cy - CS * (0.12 + Math.min(lap, 5) * 0.018);
  const baseFS  = G.pot >= 100000 ? CS * 0.24
                : G.pot >= 10000  ? CS * 0.28
                : G.pot >= 1000   ? CS * 0.33 : CS * 0.39;
  const lapFS   = baseFS * (1 + Math.min(lap, 5) * 0.055);
  const glowAmt = 18 + lap * 9;
  const potPulse = 0.45 + 0.55 * Math.sin(now * (0.003 + lap * 0.0015));

  ctx.save();
  ctx.font        = `bold ${lapFS}px 'Courier New',monospace`;
  ctx.shadowColor = G.pot > 0 ? col : 'transparent';
  ctx.shadowBlur  = glowAmt * potPulse;
  ctx.fillStyle   = G.pot > 0 ? col : 'rgba(255,255,255,0.18)';
  ctx.strokeStyle = 'rgba(0,0,0,0.62)';
  ctx.lineWidth = Math.max(3, CS * 0.035);
  ctx.strokeText('$' + G.pot.toLocaleString(), cx, potCY);
  ctx.fillText('$' + G.pot.toLocaleString(), cx, potCY);
  ctx.restore();

  ctx.save();
  ctx.font = `bold ${CS * 0.082}px 'Courier New',monospace`;
  ctx.fillStyle = 'rgba(255,215,106,0.58)';
  ctx.fillText('PROPERTY BANK', cx, potCY + CS * 0.35);
  ctx.restore();

  // ── 倍率與預估提領（lap ≥ 2，愈大愈搶眼）──────────────────
  const mult = cashMult();
  if (lap >= 2) {
    const mPulse = 0.6 + 0.4 * Math.sin(now * (0.003 + lap * 0.001));
    const plateW = CS * 1.72;
    const plateH = CS * 0.35;
    const plateX = cx - plateW / 2;
    const plateY = cy + CS * 0.08;

    ctx.save();
    ctx.shadowColor = `rgba(255,215,106,${0.24 + mPulse * 0.28})`;
    ctx.shadowBlur = 14;
    rrFill(plateX, plateY, plateW, plateH, 10, 'rgba(255,215,106,0.12)');
    ctx.strokeStyle = `rgba(255,215,106,${0.40 + mPulse * 0.34})`;
    ctx.lineWidth = 1.2;
    rrStroke(plateX, plateY, plateW, plateH, 10);
    ctx.font = `bold ${CS * (0.135 + Math.min(lap, 5) * 0.007)}px Arial`;
    ctx.fillStyle = `rgba(255,215,106,${0.76 + mPulse * 0.24})`;
    ctx.fillText(`×${mult.toFixed(1)} MULTIPLIER`, cx, plateY + plateH * 0.51);
    ctx.restore();

    if (G.pot > 0) {
      const est = Math.floor(G.pot * mult);
      const eFS = CS * (0.145 + Math.min(lap, 5) * 0.006);
      ctx.save();
      ctx.font        = `bold ${eFS}px 'Courier New',monospace`;
      ctx.shadowColor = 'rgba(255,215,106,0.5)';
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = 'rgba(255,232,142,0.78)';
      ctx.fillText(`CLAIM $${est.toLocaleString()}`, cx, cy + CS * 0.44);
      ctx.restore();
    }

    if (lap >= 4) {
      const wPulse = 0.3 + 0.7 * Math.abs(Math.sin(now * 0.007));
      ctx.font      = `bold ${CS * 0.112}px Arial`;
      ctx.fillStyle = `rgba(255,63,100,${0.45 + wPulse * 0.45})`;
      ctx.fillText('⚠  HIGH RISK  ⚠', cx, iy + ih - CS * 0.20);
    }

  } else if (lap === 1 && G.canCashOut) {
    ctx.font      = `bold ${CS * 0.106}px Arial`;
    ctx.fillStyle = 'rgba(215,233,245,0.52)';
    ctx.fillText('+1 lap for ×1.5 bonus', cx, cy + CS * 0.28);

  } else if (G.pot === 0) {
    ctx.font      = `${CS * 0.098}px Arial`;
    ctx.fillStyle = 'rgba(215,233,245,0.38)';
    ctx.fillText('Land on properties to earn rent', cx, cy + CS * 0.16);
    ctx.fillText('Pass GO to cash out', cx, cy + CS * 0.34);
  }

  // ── 圈數 badge ───────────────────────────────────────────────
  if (lap > 0) {
    const badgePulse = 0.5 + 0.5 * Math.sin(now * (0.002 + lap * 0.001));
    ctx.font      = `bold ${CS * (0.100 + Math.min(lap, 5) * 0.006)}px 'Courier New',monospace`;
    ctx.fillStyle = `rgba(${glow},0.86)`;
    ctx.shadowColor = col;
    ctx.shadowBlur  = 6 * badgePulse;
    if (lap < 4) ctx.fillText(`LAP ${lap}`, cx, iy + ih - CS * 0.20);
    ctx.shadowBlur = 0;
  }
}

// ── 繪製棋子（外星飛船）─────────────────────────────────────
function drawToken() {
  const [col, row] = spaceGrid(G.position);
  const tx = col * CS + CS / 2;
  const ty = row * CS + CS / 2;
  const r  = CS * 0.155;
  const ts = Date.now() * 0.0022;

  // 旋轉軌道環
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(ts);
  ctx.strokeStyle = 'rgba(0,255,136,0.30)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.9, r * 0.72, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // 外部光暈
  const pulse  = 0.45 + 0.55 * Math.sin(Date.now() * 0.005);
  const outerG = ctx.createRadialGradient(tx, ty, r, tx, ty, r * 2.9);
  outerG.addColorStop(0, `rgba(0,255,136,${0.18 * pulse})`);
  outerG.addColorStop(1, 'rgba(0,255,136,0)');
  ctx.beginPath();
  ctx.arc(tx, ty, r * 2.9, 0, Math.PI * 2);
  ctx.fillStyle = outerG;
  ctx.fill();

  // 陰影
  ctx.beginPath();
  ctx.arc(tx + 2, ty + 2, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fill();

  // 主體（外星綠色發光球）
  const body = ctx.createRadialGradient(tx - r*0.32, ty - r*0.35, r*0.04, tx, ty, r);
  body.addColorStop(0,    '#d0ffe8');
  body.addColorStop(0.22, '#00ff88');
  body.addColorStop(0.65, '#009955');
  body.addColorStop(1,    '#003d22');
  ctx.beginPath();
  ctx.arc(tx, ty, r, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  // 發光邊框
  ctx.save();
  ctx.strokeStyle = 'rgba(0,255,136,0.85)';
  ctx.lineWidth   = 1.5;
  ctx.shadowColor = 'rgba(0,255,136,0.9)';
  ctx.shadowBlur  = 8;
  ctx.stroke();
  ctx.restore();

  // 內環
  ctx.beginPath();
  ctx.arc(tx, ty, r * 0.40, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,20,10,0.6)';
  ctx.lineWidth   = 1.2;
  ctx.stroke();
  ctx.fillStyle   = 'rgba(0,10,6,0.45)';
  ctx.fill();

  // 中心點
  ctx.beginPath();
  ctx.arc(tx, ty, r * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = '#00ff88';
  ctx.fill();
}

// ── 特效渲染 ──────────────────────────────────────────────────
function drawSpotlight() {
  if (!FX) return;
  ctx.save();
  const rgb = hexToRgb(FX.color);
  const g = ctx.createRadialGradient(FX.x, FX.y, 0, FX.x, FX.y, FX.r);
  g.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${FX.alpha * 0.42})`);
  g.addColorStop(0.35, `rgba(${rgb.r},${rgb.g},${rgb.b},${FX.alpha * 0.18})`);
  g.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, BS, BS);

  ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${FX.alpha * 0.75})`;
  ctx.lineWidth = Math.max(2, CS * 0.025);
  ctx.shadowColor = FX.color;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(FX.x, FX.y, FX.r * (0.18 + FX.alpha * 0.08), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  PS.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.r), 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawFloatTexts() {
  FT.forEach(f => {
    ctx.globalAlpha = Math.max(0, f.alpha);
    ctx.font        = `bold ${CS * 0.185}px Arial`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle  = 'rgba(0,0,0,0.75)';
    ctx.lineWidth    = 4;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle  = f.color;
    ctx.fillText(f.text, f.x, f.y);
  });
  ctx.globalAlpha = 1;
}

function drawBigText() {
  if (!BT) return;
  ctx.save();
  ctx.globalAlpha = BT.alpha;
  ctx.font        = `bold ${CS * 0.44}px Arial`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = BT.color;
  ctx.shadowBlur  = 35;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth   = 10;
  ctx.strokeText(BT.text, BS / 2, BS / 2);
  ctx.fillStyle   = BT.color;
  ctx.fillText(BT.text, BS / 2, BS / 2);
  ctx.restore();
}

// ── 圈數顏色 ──────────────────────────────────────────────────
function lapColor(laps) {
  const COLORS = ['#3cffb0','#3cffb0','#b8ff3c','#ffd76a','#ff9f2f','#ff3f64'];
  return COLORS[Math.min(laps, COLORS.length - 1)];
}

// ── 工具函數 ──────────────────────────────────────────────────
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
}

function pill(x, y, w, h, color, text) {
  const rgb = hexToRgb(color);
  ctx.save();
  ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},0.28)`;
  ctx.shadowBlur = 7;
  rrFill(x, y, w, h, h / 2, `rgba(${rgb.r},${rgb.g},${rgb.b},0.14)`);
  ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.52)`;
  ctx.lineWidth = 1;
  rrStroke(x, y, w, h, h / 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h * 0.53);
  ctx.restore();
}

function flashAt(x, y, color, r = CS * 1.1) {
  FX = { x, y, color, r, alpha: 1, decay: 0.045 };
}

function isProperty(sp) {
  return sp.type === 'prize' || sp.type === 'jackpot';
}

function propertyLevel(sp) {
  return isProperty(sp) ? G.houseLevels[sp.id] || 0 : 0;
}

function propertyMultiplier(sp) {
  if (!isProperty(sp)) return sp.mult || 0;
  const level = propertyLevel(sp);
  const step = sp.type === 'jackpot' ? 6 : 1;
  return sp.mult + level * step;
}

function upgradeProperty(sp) {
  if (!isProperty(sp)) return 0;
  const next = Math.min(MAX_HOUSE_LEVEL, propertyLevel(sp) + 1);
  G.houseLevels[sp.id] = next;
  return next;
}

function houseLabel(level) {
  if (level >= MAX_HOUSE_LEVEL) return 'Hotel';
  if (level <= 0) return 'Empty';
  return `Lv.${level}`;
}

function drawMultiplierBadge(cx, cy, mult, th) {
  const text = `×${mult}`;
  const fs = CS * 0.168;
  const rgb = hexToRgb(th.edge);

  ctx.save();
  ctx.font = `900 ${fs}px Impact, 'Arial Black', sans-serif`;
  const tw = ctx.measureText(text).width;
  const padX = CS * 0.072;
  const padY = CS * 0.026;
  const bw = tw + padX * 2;
  const bh = fs * 0.80 + padY * 2;
  const bx = cx - bw * 0.5;
  const by = cy - bh * 0.5;

  ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},0.88)`;
  ctx.shadowBlur = 14;
  rrFill(bx, by, bw, bh, CS * 0.045, 'rgba(2,8,18,0.88)');
  rrFill(bx + CS * 0.010, by + CS * 0.010, bw - CS * 0.020, bh * 0.42, CS * 0.030, `rgba(${rgb.r},${rgb.g},${rgb.b},0.20)`);
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1.5, CS * 0.016);
  ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.82)`;
  rrStroke(bx, by, bw, bh, CS * 0.045);
  ctx.lineWidth = Math.max(1, CS * 0.006);
  ctx.strokeStyle = 'rgba(255,255,255,0.42)';
  rrStroke(bx + CS * 0.004, by + CS * 0.004, bw - CS * 0.008, bh - CS * 0.008, CS * 0.040);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = th.edge;
  ctx.shadowBlur = 10;
  ctx.lineWidth = Math.max(3, CS * 0.028);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.80)';
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, cx, cy);

  ctx.restore();
}

function drawHouseLevel(x, y, w, h, sp, th) {
  const level = propertyLevel(sp);
  const baseScale = 0.82 + Math.min(sp.mult, 8) * 0.055;
  const levelScale = level * 0.052;
  const bx = x + w * 0.50;
  const by = y + h * (0.66 - (baseScale - 1) * 0.06);
  const bw = w * (level >= MAX_HOUSE_LEVEL ? 0.58 : 0.50) * baseScale;
  const bd = h * 0.20 * baseScale;
  const bh = h * (0.16 + sp.mult * 0.035 + levelScale) * baseScale;
  const active = level > 0;
  const rgb = hexToRgb(th.edge);

  ctx.save();
  ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},${active ? 0.45 : 0.22})`;
  ctx.shadowBlur = active ? 10 : 6;

  // ground pad
  ctx.beginPath();
  ctx.moveTo(bx - bw * 0.64, by + bd * 0.18);
  ctx.lineTo(bx, by - bd * 0.50);
  ctx.lineTo(bx + bw * 0.66, by + bd * 0.14);
  ctx.lineTo(bx, by + bd * 0.80);
  ctx.closePath();
  ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${active ? 0.18 : 0.10})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${active ? 0.42 : 0.26})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  const topY = by - bh;
  const left = bx - bw * 0.44;
  const right = bx + bw * 0.40;

  // front face
  const front = ctx.createLinearGradient(left, topY, left, by);
  front.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.82)`);
  front.addColorStop(1, `rgba(${Math.max(0, rgb.r - 45)},${Math.max(0, rgb.g - 45)},${Math.max(0, rgb.b - 45)},0.92)`);
  ctx.beginPath();
  ctx.moveTo(left, topY + bd * 0.52);
  ctx.lineTo(right, topY + bd * 0.82);
  ctx.lineTo(right, by);
  ctx.lineTo(left, by - bd * 0.26);
  ctx.closePath();
  ctx.fillStyle = front;
  ctx.fill();

  // side face
  ctx.beginPath();
  ctx.moveTo(right, topY + bd * 0.82);
  ctx.lineTo(bx + bw * 0.62, topY + bd * 0.34);
  ctx.lineTo(bx + bw * 0.62, by - bd * 0.50);
  ctx.lineTo(right, by);
  ctx.closePath();
  ctx.fillStyle = `rgba(${Math.max(0, rgb.r - 65)},${Math.max(0, rgb.g - 65)},${Math.max(0, rgb.b - 65)},0.86)`;
  ctx.fill();

  // flat top face — property color (visible from above in isometric view)
  ctx.beginPath();
  ctx.moveTo(left,             topY + bd * 0.52);
  ctx.lineTo(bx - bw * 0.16,  topY);
  ctx.lineTo(bx + bw * 0.62,  topY + bd * 0.34);
  ctx.lineTo(right,            topY + bd * 0.82);
  ctx.closePath();
  ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.82)`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.52)`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── Gabled roof (mult ≥ 5 only) ──────────────────────────────
  const ridgeH = bh * 0.38;
  const ovh    = bw * 0.055;
  const eaveTh = bd * 0.16;

  const eFL = { x: left  - ovh,                 y: topY + bd * 0.52 + ovh * 0.22 };
  const eFR = { x: right + ovh,                 y: topY + bd * 0.82 + ovh * 0.22 };
  const eBL = { x: bx - bw * 0.16 - ovh * 0.5, y: topY - ovh * 0.12 };
  const eBR = { x: bx + bw * 0.62 + ovh * 0.5, y: topY + bd * 0.34 + ovh * 0.12 };
  const ridgeL = { x: (eFL.x + eBL.x) / 2, y: (eFL.y + eBL.y) / 2 - ridgeH };
  const ridgeR = { x: (eFR.x + eBR.x) / 2, y: (eFR.y + eBR.y) / 2 - ridgeH };

  if (propertyMultiplier(sp) >= 5) {
    const roofTopColor  = `rgba(${rgb.r},${rgb.g},${rgb.b},0.80)`;
    const roofFaceColor = `rgba(${Math.min(255,rgb.r+55)},${Math.min(255,rgb.g+55)},${Math.min(255,rgb.b+55)},0.92)`;
    const roofSoftColor = `rgba(${Math.max(0,rgb.r-55)},${Math.max(0,rgb.g-55)},${Math.max(0,rgb.b-55)},0.85)`;

    // Back/top slope — visible from above
    ctx.beginPath();
    ctx.moveTo(ridgeL.x, ridgeL.y);
    ctx.lineTo(ridgeR.x, ridgeR.y);
    ctx.lineTo(eBR.x, eBR.y);
    ctx.lineTo(eBL.x, eBL.y);
    ctx.closePath();
    ctx.fillStyle = roofTopColor;
    ctx.fill();
    ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.38)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Front slope — lighter, faces viewer
    ctx.beginPath();
    ctx.moveTo(ridgeL.x, ridgeL.y);
    ctx.lineTo(ridgeR.x, ridgeR.y);
    ctx.lineTo(eFR.x, eFR.y);
    ctx.lineTo(eFL.x, eFL.y);
    ctx.closePath();
    ctx.fillStyle = roofFaceColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Eave soffit — underside strip showing thickness
    ctx.beginPath();
    ctx.moveTo(eFL.x, eFL.y);
    ctx.lineTo(eFR.x, eFR.y);
    ctx.lineTo(eFR.x, eFR.y + eaveTh);
    ctx.lineTo(eFL.x, eFL.y + eaveTh);
    ctx.closePath();
    ctx.fillStyle = roofSoftColor;
    ctx.fill();

    // Ridge highlight
    ctx.beginPath();
    ctx.moveTo(ridgeL.x, ridgeL.y);
    ctx.lineTo(ridgeR.x, ridgeR.y);
    ctx.lineWidth = Math.max(1.5, CS * 0.014);
    ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.72)`;
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // windows
  const rows = Math.max(1, Math.min(4, level + Math.floor(sp.mult / 3)));
  const cols = sp.mult >= 4 || level >= 4 ? 3 : 2;
  ctx.fillStyle = level >= MAX_HOUSE_LEVEL ? 'rgba(33,18,0,0.72)' : 'rgba(3,16,31,0.64)';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = left + bw * (0.19 + c * 0.23);
      const wy = topY + bd * 0.96 + r * bh * 0.15;
      rrFill(wx, wy, bw * 0.115, Math.max(2, bh * 0.072), 2, ctx.fillStyle);
    }
  }

  // door and entry light
  const doorW = bw * 0.14;
  const doorH = Math.max(CS * 0.055, bh * 0.18);
  rrFill(bx - doorW * 0.5, by - doorH * 0.72, doorW, doorH, 3, 'rgba(0,0,0,0.48)');
  ctx.fillStyle = level >= MAX_HOUSE_LEVEL ? '#ffd76a' : th.edge;
  ctx.beginPath();
  ctx.arc(bx + doorW * 0.26, by - doorH * 0.30, Math.max(1, CS * 0.01), 0, Math.PI * 2);
  ctx.fill();


  if (level >= MAX_HOUSE_LEVEL) {
    ctx.font = `bold ${CS * 0.078}px 'Courier New',monospace`;
    ctx.fillStyle = '#ffd76a';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 8;
    const hotelY = propertyMultiplier(sp) >= 5 ? ridgeL.y - CS * 0.04 : topY - bd * 0.14;
    ctx.fillText('HOTEL', bx + bw * 0.04, hotelY);
  }

  ctx.shadowBlur = 0;
  drawMultiplierBadge(x + w * 0.50, y + h * 0.875, propertyMultiplier(sp), th);
  ctx.restore();
}

function drawHazardStripes(x, y, w, h, th, pulse) {
  ctx.save();
  rrPath(x, y, w, h, 11);
  ctx.clip();
  ctx.translate(x + w * 0.12, y + h * 0.09);
  ctx.rotate(-0.62);
  for (let i = -4; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0
      ? `rgba(${th.glow},${0.10 + pulse * 0.05})`
      : 'rgba(0,0,0,0)';
    ctx.fillRect(i * w * 0.22, 0, w * 0.09, h * 1.28);
  }
  ctx.restore();
}

function drawWarpMark(cx, cy, r, th, now) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(now * 0.0016);
  ctx.strokeStyle = `rgba(${th.glow},0.40)`;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * (1.05 + i * 0.18), r * (0.40 + i * 0.10), i * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function rrPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);    ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}
function rrFill(x,y,w,h,r,c) { rrPath(x,y,w,h,r); ctx.fillStyle=c; ctx.fill(); }
function rrStroke(x,y,w,h,r) { rrPath(x,y,w,h,r); ctx.stroke(); }

// ── 特效生成器 ────────────────────────────────────────────────
function burst(x, y, n, colors, speed, decay, grav) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * 0.35 + Math.random() * speed;
    PS.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      r:    1.5 + Math.random() * 2.5,
      color: colors[i % colors.length],
      alpha: 0.95, decay, grav,
    });
  }
}

function coinShower(count) {
  for (let i = 0; i < count; i++) {
    PS.push({
      x:  BS * 0.08 + Math.random() * BS * 0.84,
      y: -8 - Math.random() * 30,
      vx: (Math.random() - 0.5) * 3.5,
      vy:  1.8 + Math.random() * 4,
      r:   2 + Math.random() * 3.5,
      color: i % 3 === 0 ? '#00ff88' : i % 3 === 1 ? '#ffd600' : '#00c8ff',
      alpha: 1, decay: 0.006, grav: 0.08,
    });
  }
}

function addFloat(x, y, text, color) {
  FT.push({ x, y, text, color, alpha: 1 });
}

function showBig(text, color, dur = 2000) {
  BT = { text, color, alpha: 0, age: 0, dur };
}

function screenShake() {
  const el = document.getElementById('board-wrap');
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

function tokenXY() {
  const [col, row] = spaceGrid(G.position);
  return [col * CS + CS / 2, row * CS + CS / 2];
}

// ── 下注調整 ──────────────────────────────────────────────────
function adjustBet(dir) {
  if (G.animating) return;
  AUDIO.click();
  G.betIdx = Math.max(0, Math.min(BET_LEVELS.length - 1, G.betIdx + dir));
  document.getElementById('bet-val').textContent = '$' + BET_LEVELS[G.betIdx];
}

// ── 擲骰子 ────────────────────────────────────────────────────
async function onRoll() {
  if (G.animating) return;
  const bet = BET_LEVELS[G.betIdx];
  if (G.balance < bet) { setStatus('× Insufficient credits — lower your bet'); return; }

  AUDIO.init();
  G.animating = true;
  document.getElementById('roll-btn').disabled = true;
  G.balance -= bet;
  G.canCashOut = false;
  hideCashBtn();
  updateHUD();

  const d1 = r6(), d2 = r6(), total = d1 + d2;

  document.getElementById('dice-wrap').classList.remove('invisible');
  AUDIO.dice();
  flashAt(BS / 2, BS / 2, '#ffd76a', CS * 1.6);
  setStatus('Rolling...');

  await animateDiceRoll(d1, d2);
  setStatus(`${d1} + ${d2} = ${total} — move ${total} spaces`);
  animateMove(total);
}

function r6() { return Math.ceil(Math.random() * 6); }

function animateDiceRoll(finalD1, finalD2) {
  const d1El = document.getElementById('d1');
  const d2El = document.getElementById('d2');
  const totalEl = document.getElementById('dtot');
  const stage = document.getElementById('dice-stage');
  const stageDie1 = document.getElementById('stage-die1');
  const stageDie2 = document.getElementById('stage-die2');
  const duration = 920;
  const tick = 72;
  let elapsed = 0;
  let soundTick = 0;

  d1El.classList.remove('settle');
  d2El.classList.remove('settle');
  totalEl.classList.remove('pop');
  d1El.classList.add('rolling');
  d2El.classList.add('rolling');
  stage.classList.remove('hidden');
  stageDie1.classList.remove('settle');
  stageDie2.classList.remove('settle');
  stageDie1.classList.add('rolling');
  stageDie2.classList.add('rolling');
  totalEl.textContent = '...';

  return new Promise(resolve => {
    const timer = setInterval(() => {
      elapsed += tick;
      soundTick++;
      d1El.textContent = DICE_EMOJI[r6() - 1];
      d2El.textContent = DICE_EMOJI[r6() - 1];
      if (soundTick % 2 === 0) AUDIO.diceTick();

      if (elapsed >= duration) {
        clearInterval(timer);
        AUDIO.diceLand();
        d1El.classList.remove('rolling');
        d2El.classList.remove('rolling');
        stageDie1.classList.remove('rolling');
        stageDie2.classList.remove('rolling');
        d1El.textContent = DICE_EMOJI[finalD1 - 1];
        d2El.textContent = DICE_EMOJI[finalD2 - 1];
        totalEl.textContent = finalD1 + finalD2;
        setStageDieFace(stageDie1, finalD1);
        setStageDieFace(stageDie2, finalD2);

        void d1El.offsetWidth;
        void stageDie1.offsetWidth;
        d1El.classList.add('settle');
        d2El.classList.add('settle');
        stageDie1.classList.add('settle');
        stageDie2.classList.add('settle');
        totalEl.classList.add('pop');

        setTimeout(() => {
          stage.classList.add('hidden');
          stageDie1.classList.remove('settle');
          stageDie2.classList.remove('settle');
          resolve();
        }, 680);
      }
    }, tick);
  });
}

function setStageDieFace(el, face) {
  const rotations = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateX(0deg) rotateY(-90deg)',
    3: 'rotateX(-90deg) rotateY(0deg)',
    4: 'rotateX(90deg) rotateY(0deg)',
    5: 'rotateX(0deg) rotateY(90deg)',
    6: 'rotateX(0deg) rotateY(180deg)',
  };
  el.style.setProperty('--final-rot', rotations[face]);
}

function pickFortuneOptions() {
  const pool = [0, 0, 1, 2, 3, 5];
  const options = [];
  while (options.length < 3) {
    options.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  if (options.every(v => v === 0)) options[Math.floor(Math.random() * 3)] = 1;
  return options;
}

function setFortuneCardFace(card, mult) {
  const isReward = mult > 0;
  card.classList.toggle('reward', isReward);
  card.classList.toggle('blank', !isReward);
  card.querySelector('.card-art').textContent = isReward ? '◆' : '○';
  card.querySelector('.card-title').textContent = isReward ? 'RENT CONTRACT' : 'VOID CARD';
  card.querySelector('.card-result').textContent = isReward ? `Vault + bet ×${mult}` : 'No reward';
  card.querySelector('.card-desc').textContent = isReward
    ? `Add ${mult}× your bet to the vault immediately.`
    : 'No vault bonus this turn. Keep moving.';
}

function animateFortuneCard() {
  const stage = document.getElementById('card-stage');
  const cards = Array.from(document.querySelectorAll('.fortune-card'));
  const options = pickFortuneOptions();

  cards.forEach((card, i) => {
    card.classList.remove('draw', 'flip', 'peek', 'chosen', 'revealed', 'reward', 'blank');
    setFortuneCardFace(card, options[i]);
    card.disabled = false;
    card.style.animationDelay = `${i * 70}ms`;
  });

  stage.classList.remove('hidden');
  void cards[0].offsetWidth;
  cards.forEach(card => card.classList.add('draw'));
  setStatus('Pick a card — choose wisely');

  return new Promise(resolve => {
    const reveal = ev => {
      const chosen = ev.currentTarget;
      const chosenIdx = Number(chosen.dataset.card);
      cards.forEach(card => {
        card.removeEventListener('click', reveal);
        card.disabled = true;
      });
      AUDIO.random();
      chosen.classList.add('chosen', 'flip', 'revealed');
      setStatus('Card revealed!');

      setTimeout(() => {
        cards.forEach((card, i) => {
          if (i !== chosenIdx) card.classList.add('peek', 'revealed');
        });
        setStatus('Other cards revealed');
      }, 920);

      setTimeout(() => {
        stage.classList.add('hidden');
        cards.forEach(card => {
          card.classList.remove('draw', 'flip', 'peek', 'chosen', 'revealed', 'reward', 'blank');
          card.disabled = false;
          card.style.animationDelay = '';
        });
        resolve(options[chosenIdx]);
      }, 2100);
    };

    setTimeout(() => {
      cards.forEach(card => card.addEventListener('click', reveal));
    }, 360);
  });
}

// ── 棋子移動動畫 ──────────────────────────────────────────────
function animateMove(steps) {
  let moved = 0, passedStart = false;

  const step = () => {
    if (moved >= steps) {
      G.animating = false;
      document.getElementById('roll-btn').disabled = false;
      if (passedStart) G.laps++;
      resolveSpace(passedStart);
      return;
    }

    // 移動前留下拖尾粒子
    AUDIO.step();
    const [px, py] = tokenXY();
    for (let i = 0; i < 4; i++) {
      PS.push({
        x: px + (Math.random() - 0.5) * CS * 0.18,
        y: py + (Math.random() - 0.5) * CS * 0.18,
        vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6,
        r: 1 + Math.random() * 1.2,
        color: 'rgba(0,255,136,0.6)',
        alpha: 0.65, decay: 0.04, grav: 0,
      });
    }

    G.position = (G.position + 1) % 16;
    if (G.position === 0) {
      if (moved < steps - 1) passedStart = true;
      AUDIO.passStart();
    }
    moved++;
    setTimeout(step, 105);
  };

  setTimeout(step, 80);
}

// ── 落點處理 ──────────────────────────────────────────────────
async function resolveSpace(passedStart) {
  const sp  = SPACES[G.position];
  const bet = BET_LEVELS[G.betIdx];
  const [tx, ty] = tokenXY();
  let   msg = '';

  if (sp.type === 'start') {
    G.laps++;
    passedStart = true;
    flashAt(tx, ty, '#ffd76a', CS * 1.25);
    burst(tx, ty, 20, ['#ffd600','#fff','#00ff88'], 2.5, 0.022, 0.06);
    msg = 'Back to GO BASE';

  } else if (isProperty(sp)) {
    const beforeLevel = propertyLevel(sp);
    const rentMult = propertyMultiplier(sp);
    const earn = bet * rentMult;
    const newLevel = upgradeProperty(sp);
    const levelMsg = newLevel > beforeLevel ? `→ ${houseLabel(newLevel)}` : `${houseLabel(newLevel)} max`;
    G.pot += earn;
    updateHUD();

    if (sp.type === 'jackpot') {
      AUDIO.jackpot();
      flashAt(tx, ty, '#ff9f2f', CS * 1.75);
      burst(tx, ty, 100, ['#ff6d00','#ffd600','#ff1744','#fff','#ffaa00'], 6, 0.007, 0.05);
      burst(tx, ty,  50, ['#00ff88','#00c8ff','#aa00ff'],                  8, 0.005, 0.04);
      coinShower(60);
      showBig('LANDMARK!', '#ff9f2f', 2500);
      setStatus(`${sp.name}  Rent ×${rentMult} → Vault +$${earn}  ${levelMsg}`);
    } else {
      AUDIO.prize(Math.min(rentMult, 5));
      flashAt(tx, ty, '#3cffb0', CS * 1.15);
      burst(tx, ty, 32, ['#00ff88','#ffd600','#00c8ff','#aaffcc'], 3.5, 0.018, 0.08);
      setStatus(`${sp.name}  Rent ×${rentMult} → Vault +$${earn}  ${levelMsg}`);
    }
    addFloat(tx, ty - CS * 0.32, `+$${earn}`,
      sp.type === 'jackpot' ? '#ff9f2f' : '#00ff88');
    if (newLevel > beforeLevel) addFloat(tx, ty + CS * 0.08, `Lv.${newLevel}`, '#ffd76a');
    msg = '';

  } else if (sp.type === 'danger') {
    const actualLose = sp.wipePot ? G.pot : Math.min(G.pot, bet * sp.pen);
    if (sp.wipePot) {
      G.pot = 0;
      G.houseLevels.fill(0);
      G.position = 0;
      G.laps = 0;
      G.canCashOut = false;
      hideCashBtn();
    } else {
      G.pot = Math.max(0, G.pot - bet * sp.pen);
    }
    updateHUD();
    AUDIO.danger(sp.pen);
    flashAt(tx, ty, sp.wipePot ? '#ff1744' : '#ff3f64', sp.wipePot ? CS * 1.85 : CS * 1.35);
    burst(tx, ty, sp.wipePot ? 70 : 35, ['#ff1744','#ff5252','#aa0020'], sp.wipePot ? 5 : 3, 0.018, 0.07);
    addFloat(tx, ty - CS * 0.32, `-$${actualLose}`, '#ff4060');
    screenShake();
    msg = sp.wipePot
      ? `${sp.name}  Vault wiped — properties reset — back to GO`
      : `${sp.name}  Vault -$${actualLose}`;

  } else if (sp.type === 'random') {
    AUDIO.random();
    flashAt(tx, ty, '#b985ff', CS * 1.25);
    const rm = await animateFortuneCard();
    if (rm > 0) {
      const earn = bet * rm;
      G.pot += earn;
      updateHUD();
      burst(tx, ty, 40, ['#ce93d8','#aa00ff','#00c8ff','#ffd600'], 4, 0.016, 0.07);
      addFloat(tx, ty - CS * 0.32, `+$${earn}`, '#ce93d8');
      msg = `Fate Card  Rent bonus ×${rm}  Vault +$${earn}`;
    } else {
      burst(tx, ty, 18, ['#5c0080','#9900bb'], 1.8, 0.025, 0.05);
      msg = 'Fate Card  Void — no reward this turn';
    }
  }

  if (msg) setStatus(msg);

  // 經過/落在出發點且有獎池 → 顯示提領
  if (passedStart && G.pot > 0) {
    G.canCashOut = true;
    showCashBtn();
  }

  // 破產判斷
  if (G.balance <= 0 && G.pot <= 0) {
    setTimeout(gameOver, 800);
    return;
  }

  // 自動降低下注
  autoAdjustBet();

  // 餘額不足最低下注且無獎池
  if (G.balance < BET_LEVELS[0] && G.pot <= 0) {
    setTimeout(gameOver, 800);
  }

  updateHUD();
}

// ── 提領 ──────────────────────────────────────────────────────
function onCashOut() {
  if (!G.canCashOut || G.pot <= 0) return;
  const mult    = cashMult();
  const cashVal = Math.floor(G.pot * mult);
  G.balance    += cashVal;
  G.totalWon   += cashVal;

  // 金幣慶祝
  AUDIO.cashOut();
  coinShower(100);
  const [tx, ty] = tokenXY();
  flashAt(tx, ty, '#3cffb0', CS * 1.55);
  burst(tx, ty, 60, ['#00ff88','#ffd600','#00c8ff','#aaffdd'], 5, 0.008, 0.05);
  showBig(`+$${cashVal.toLocaleString()}`, '#00ff88', 2200);

  const potWas = G.pot;
  G.pot = 0; G.laps = 0; G.canCashOut = false;
  G.houseLevels.fill(0);
  hideCashBtn();

  setStatus(`Cashed out  $${potWas.toLocaleString()}${mult > 1 ? ' ×' + mult.toFixed(1) : ''} → $${cashVal.toLocaleString()} credited`);
  updateHUD();
}

// ── 遊戲結束 ──────────────────────────────────────────────────
function gameOver() {
  document.getElementById('over-sub').innerHTML =
    `Total winnings: <strong style="color:#00ff88;font-family:monospace">$${G.totalWon.toLocaleString()}</strong>`;
  document.getElementById('overlay').classList.remove('hidden');
}

function restart() {
  Object.assign(G, {
    balance:1000, pot:0, betIdx:2, position:0,
    laps:0, canCashOut:false, animating:false, totalWon:0,
    houseLevels:Array(16).fill(0),
  });
  PS.length = 0; FT.length = 0; BT = null; FX = null;
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('roll-btn').disabled = false;
  document.getElementById('dice-wrap').classList.add('invisible');
  hideCashBtn();
  setStatus('Ready? Roll the dice!');
  updateHUD();
}

// ── HUD ───────────────────────────────────────────────────────
function cashMult() {
  // lap=0,1: ×1.0   lap=2: ×1.5   lap=3: ×2.0 …
  return Math.max(1.0, 0.5 + G.laps * 0.5);
}

function updateHUD() {
  document.getElementById('balance-val').textContent = '$' + G.balance.toLocaleString();
  document.getElementById('pot-val').textContent     = '$' + G.pot.toLocaleString();
}

function setStatus(msg) {
  document.getElementById('status-bar').textContent = msg;
}

function showCashBtn() {
  const mult    = cashMult();
  const cashVal = Math.floor(G.pot * mult);
  document.getElementById('cash-btn').textContent =
    mult > 1
      ? `CASH OUT  $${cashVal.toLocaleString()}  ×${mult.toFixed(1)}`
      : `CASH OUT  $${cashVal.toLocaleString()}`;
  document.getElementById('cash-btn').classList.remove('hidden');
}

function hideCashBtn() {
  document.getElementById('cash-btn').classList.add('hidden');
}

function autoAdjustBet() {
  while (G.betIdx > 0 && G.balance < BET_LEVELS[G.betIdx]) G.betIdx--;
  document.getElementById('bet-val').textContent = '$' + BET_LEVELS[G.betIdx];
}
