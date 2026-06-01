'use strict';
// ════════════════════════════════════════════════════════════
//  星際賭場 — 外星人博彩遊戲
// ════════════════════════════════════════════════════════════

const DICE_EMOJI = ['⚀','⚁','⚂','⚃','⚄','⚅'];
const BET_LEVELS = [10, 25, 50, 100, 200, 500];

const SPACES = [
  { id:0,  name:'星際基地', type:'start',   icon:'🛸', bg:'#1e0e00', bdr:'#ffd600' },
  { id:1,  name:'隕石坑',   type:'prize',   icon:'🌠', mult:1, bg:'#001e0e' },
  { id:2,  name:'能量水晶', type:'prize',   icon:'💎', mult:3, bg:'#000e28' },
  { id:3,  name:'異次元',   type:'random',  icon:'🌀', bg:'#140030' },
  { id:4,  name:'黑洞',     type:'danger',  icon:'⚫', pen:1,  bg:'#1e0000' },
  { id:5,  name:'外星基地', type:'prize',   icon:'👾', mult:2, bg:'#001e0e' },
  { id:6,  name:'超新星',   type:'prize',   icon:'⭐', mult:5, bg:'#1e1000' },
  { id:7,  name:'蟲洞',     type:'danger',  icon:'🌪️', pen:2,  bg:'#1e0000' },
  { id:8,  name:'暗物質',   type:'prize',   icon:'🔮', mult:3, bg:'#0a0022' },
  { id:9,  name:'隕石坑',   type:'prize',   icon:'🌠', mult:1, bg:'#001e0e' },
  { id:10, name:'宇宙爆炸', type:'jackpot', icon:'💥', mult:8, bg:'#200010', bdr:'#ff6d00' },
  { id:11, name:'異次元',   type:'random',  icon:'🌀', bg:'#140030' },
  { id:12, name:'黑洞',     type:'danger',  icon:'⚫', pen:1,  bg:'#1e0000' },
  { id:13, name:'外星文明', type:'prize',   icon:'🗿', mult:3, bg:'#001e0e' },
  { id:14, name:'宇宙寶藏', type:'prize',   icon:'🚀', mult:4, bg:'#1e1000' },
  { id:15, name:'隕石坑',   type:'prize',   icon:'🌠', mult:1, bg:'#001e0e' },
];

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
};

// ── 特效狀態 ──────────────────────────────────────────────────
const PS = [];       // 粒子: {x,y,vx,vy,r,color,alpha,decay,grav}
const FT = [];       // 浮動文字: {x,y,text,color,alpha}
let   BT = null;     // 大字幕: {text,color,alpha,age,dur}

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

  document.getElementById('bgm-btn').addEventListener('click', () => {
    AUDIO.init();
    const on = AUDIO.toggleBGM();
    document.getElementById('bgm-btn').classList.toggle('off', !on);
  });
  document.getElementById('sfx-btn').addEventListener('click', () => {
    AUDIO.init();
    const on = AUDIO.toggleSFX();
    document.getElementById('sfx-btn').classList.toggle('off', !on);
  });

  updateHUD();
  requestAnimationFrame(loop);
});

function resizeBoard() {
  const wrap = document.getElementById('board-wrap');
  const sz   = Math.min(wrap.clientWidth, wrap.clientHeight) - 4;
  BS = sz; CS = sz / 5;
  canvas.width = sz; canvas.height = sz;
}

// ── 動畫主迴圈（~36fps）────────────────────────────────────────
function loop(ts) {
  requestAnimationFrame(loop);
  if (ts - lastDraw < 27) return;
  lastDraw = ts;

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

  // 棋盤背景
  rrFill(0, 0, BS, BS, 14, '#020410');

  // 繪製所有格子
  SPACES.forEach(drawCell);

  // 繪製中央面板
  drawCenter();

  // 繪製棋子
  drawToken();

  // 繪製特效（疊加在最上層）
  drawParticles();
  drawFloatTexts();
  drawBigText();
}

// ── 繪製格子 ──────────────────────────────────────────────────
function drawCell(sp) {
  const [col, row] = spaceGrid(sp.id);
  const x = col * CS, y = row * CS, pd = 2.5;
  const now = Date.now();

  // 底色
  rrFill(x+pd, y+pd, CS-pd*2, CS-pd*2, 9, sp.bg || '#04051a');

  // 動態邊框
  ctx.save();
  if (sp.type === 'jackpot') {
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.004);
    ctx.shadowColor = `rgba(255,109,0,${pulse})`;
    ctx.shadowBlur  = 14 * pulse;
    ctx.strokeStyle = `rgba(255,109,0,${0.5 + pulse * 0.5})`;
    ctx.lineWidth   = 1.5 + pulse * 1.5;
  } else if (sp.type === 'start') {
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.0025);
    ctx.shadowColor = `rgba(255,214,0,${pulse * 0.6})`;
    ctx.shadowBlur  = 10 * pulse;
    ctx.strokeStyle = `rgba(255,214,0,${0.4 + pulse * 0.6})`;
    ctx.lineWidth   = 1.5;
  } else if (sp.type === 'danger') {
    ctx.strokeStyle = 'rgba(255,23,68,0.2)';
    ctx.lineWidth   = 0.8;
    ctx.shadowBlur  = 0;
  } else if (sp.type === 'random') {
    ctx.strokeStyle = 'rgba(206,147,216,0.22)';
    ctx.lineWidth   = 0.8;
  } else {
    ctx.strokeStyle = 'rgba(0,255,136,0.1)';
    ctx.lineWidth   = 0.8;
  }
  rrStroke(x+pd, y+pd, CS-pd*2, CS-pd*2, 9);
  ctx.restore();

  // 當前格子高亮
  if (sp.id === G.position) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth   = 2;
    ctx.shadowColor = 'rgba(255,255,255,0.4)';
    ctx.shadowBlur  = 8;
    rrStroke(x+pd, y+pd, CS-pd*2, CS-pd*2, 9);
    ctx.restore();
  }

  const cx = x + CS / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // 圖示
  ctx.font = `${CS * 0.29}px serif`;
  ctx.fillStyle = '#fff';
  ctx.fillText(sp.icon, cx, y + CS * 0.40);

  // 名稱
  ctx.font = `${CS * 0.108}px Arial`;
  ctx.fillStyle = 'rgba(168,210,255,.62)';
  ctx.fillText(sp.name, cx, y + CS * 0.70);

  // 倍率標籤
  ctx.font = `bold ${CS * 0.132}px Arial`;
  if (sp.type === 'prize') {
    ctx.fillStyle = '#00ff88';
    ctx.fillText(`×${sp.mult}`, cx, y + CS * 0.875);
  } else if (sp.type === 'jackpot') {
    ctx.fillStyle = '#ff6d00';
    ctx.fillText(`×${sp.mult}`, cx, y + CS * 0.875);
  } else if (sp.type === 'danger') {
    ctx.fillStyle = '#ff4060';
    ctx.fillText(`-×${sp.pen}`, cx, y + CS * 0.875);
  } else if (sp.type === 'random') {
    ctx.fillStyle = '#ce93d8';
    ctx.fillText('隨機', cx, y + CS * 0.875);
  }
}

// ── 繪製中央面板 ──────────────────────────────────────────────
function drawCenter() {
  const pd = 3;
  const ix = CS + pd, iy = CS + pd;
  const iw = CS * 3 - pd * 2, ih = CS * 3 - pd * 2;
  const cx = ix + iw / 2, cy = iy + ih / 2;
  const now = Date.now();

  ctx.save();
  rrPath(ix, iy, iw, ih, 12);
  ctx.clip();

  // 星雲漸層
  const nebula = ctx.createRadialGradient(cx, cy - ih*0.1, 0, cx, cy, iw * 0.85);
  nebula.addColorStop(0,   '#0c0030');
  nebula.addColorStop(0.5, '#030418');
  nebula.addColorStop(1,   '#010210');
  ctx.fillStyle = nebula;
  ctx.fillRect(ix, iy, iw, ih);

  // 動態星空
  const ts = now * 0.001;
  STARS.forEach(s => {
    const sx = ix + s.fx * iw, sy = iy + s.fy * ih;
    const twinkle = 0.15 + 0.85 * Math.abs(Math.sin(ts * s.sp + s.ph));
    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(190,225,255,${twinkle})`;
    ctx.fill();
  });

  // 掃描線
  ctx.globalAlpha = 0.04;
  for (let y = iy; y < iy + ih; y += 3) {
    ctx.fillStyle = '#000';
    ctx.fillRect(ix, y, iw, 1);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // 邊框
  ctx.strokeStyle = 'rgba(0,255,136,0.13)';
  ctx.lineWidth   = 1;
  rrStroke(ix, iy, iw, ih, 12);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // 標題
  ctx.font      = `${CS * 0.115}px 'Courier New',monospace`;
  ctx.fillStyle = 'rgba(0,255,136,0.38)';
  ctx.fillText('◈ 宇宙能量池 ◈', cx, iy + CS * 0.28);

  // 獎池金額（發光）
  const pfs = G.pot >= 10000 ? CS * 0.27 : G.pot >= 1000 ? CS * 0.31 : CS * 0.35;
  ctx.save();
  ctx.font        = `bold ${pfs}px 'Courier New',monospace`;
  ctx.shadowColor = G.pot > 0 ? 'rgba(0,255,136,0.7)' : 'transparent';
  ctx.shadowBlur  = 18;
  ctx.fillStyle   = G.pot > 0 ? '#00ff88' : 'rgba(255,255,255,0.14)';
  ctx.fillText('$' + G.pot.toLocaleString(), cx, cy - CS * 0.20);
  ctx.restore();

  // 倍率顯示
  const mult = cashMult();
  if (G.laps >= 2) {
    const pulse = 0.6 + 0.4 * Math.sin(now * 0.0035);
    ctx.save();
    ctx.font        = `bold ${CS * 0.155}px Arial`;
    ctx.shadowColor = `rgba(255,214,0,${pulse})`;
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = `rgba(255,214,0,${0.7 + pulse * 0.3})`;
    ctx.fillText(`提領倍率 ×${mult.toFixed(1)}`, cx, cy + CS * 0.17);
    ctx.restore();
    if (G.pot > 0) {
      ctx.font      = `${CS * 0.112}px monospace`;
      ctx.fillStyle = 'rgba(255,214,0,0.48)';
      ctx.fillText(`≈ $${Math.floor(G.pot * mult).toLocaleString()}`, cx, cy + CS * 0.38);
    }
  } else if (G.laps === 1 && G.canCashOut) {
    ctx.font      = `${CS * 0.108}px Arial`;
    ctx.fillStyle = 'rgba(180,200,255,0.42)';
    ctx.fillText('再繞一圈可獲 ×1.5 加成！', cx, cy + CS * 0.24);
  } else if (G.pot === 0) {
    ctx.font      = `${CS * 0.105}px Arial`;
    ctx.fillStyle = 'rgba(168,204,224,0.28)';
    ctx.fillText('落在房子贏取獎金', cx, cy + CS * 0.08);
    ctx.fillText('經過出發點可提領', cx, cy + CS * 0.28);
  }

  // 圈數
  if (G.laps > 0) {
    ctx.font      = `${CS * 0.108}px 'Courier New',monospace`;
    ctx.fillStyle = 'rgba(0,255,136,0.35)';
    ctx.fillText(`✦ 第 ${G.laps} 圈 ✦`, cx, iy + ih - CS * 0.26);
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

// ── 工具函數 ──────────────────────────────────────────────────
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
function onRoll() {
  if (G.animating) return;
  const bet = BET_LEVELS[G.betIdx];
  if (G.balance < bet) { setStatus('🛑 星幣不足，請降低下注'); return; }

  AUDIO.init();
  G.balance -= bet;
  G.canCashOut = false;
  hideCashBtn();
  updateHUD();

  const d1 = r6(), d2 = r6(), total = d1 + d2;

  document.getElementById('dice-wrap').classList.remove('invisible');
  document.getElementById('d1').textContent   = DICE_EMOJI[d1 - 1];
  document.getElementById('d2').textContent   = DICE_EMOJI[d2 - 1];
  document.getElementById('dtot').textContent = total;
  AUDIO.dice();

  document.getElementById('roll-btn').disabled = true;
  setStatus(`🚀 發射！${d1} + ${d2} = ${total}，移動 ${total} 格`);

  G.animating = true;
  animateMove(total);
}

function r6() { return Math.ceil(Math.random() * 6); }

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
function resolveSpace(passedStart) {
  const sp  = SPACES[G.position];
  const bet = BET_LEVELS[G.betIdx];
  const [tx, ty] = tokenXY();
  let   msg = '';

  if (sp.type === 'start') {
    G.laps++;
    passedStart = true;
    burst(tx, ty, 20, ['#ffd600','#fff','#00ff88'], 2.5, 0.022, 0.06);
    msg = '🛸 回到星際基地！';

  } else if (sp.type === 'prize' || sp.type === 'jackpot') {
    const earn = bet * sp.mult;
    G.pot += earn;
    updateHUD();

    if (sp.type === 'jackpot') {
      AUDIO.jackpot();
      burst(tx, ty, 100, ['#ff6d00','#ffd600','#ff1744','#fff','#ffaa00'], 6, 0.007, 0.05);
      burst(tx, ty,  50, ['#00ff88','#00c8ff','#aa00ff'],                  8, 0.005, 0.04);
      coinShower(60);
      showBig('💥 JACKPOT!', '#ff6d00', 2500);
      setStatus(`💥 宇宙爆炸！×${sp.mult} → 能量池 +$${earn}`);
    } else {
      AUDIO.prize(sp.mult);
      burst(tx, ty, 32, ['#00ff88','#ffd600','#00c8ff','#aaffcc'], 3.5, 0.018, 0.08);
      setStatus(`${sp.icon} ${sp.name} ×${sp.mult} → 能量池 +$${earn}`);
    }
    addFloat(tx, ty - CS * 0.32, `+$${earn}`,
      sp.type === 'jackpot' ? '#ff6d00' : '#00ff88');
    msg = '';

  } else if (sp.type === 'danger') {
    const lose = bet * sp.pen;
    G.balance  = Math.max(0, G.balance - lose);
    updateHUD();
    AUDIO.danger(sp.pen);
    burst(tx, ty, 35, ['#ff1744','#ff5252','#aa0020'], 3, 0.018, 0.07);
    addFloat(tx, ty - CS * 0.32, `-$${lose}`, '#ff4060');
    screenShake();
    msg = `${sp.icon} ${sp.name}！損失 $${lose}`;

  } else if (sp.type === 'random') {
    AUDIO.random();
    const RMULTS = [0, 0, 1, 2, 3, 5];
    const rm = RMULTS[Math.floor(Math.random() * RMULTS.length)];
    if (rm > 0) {
      const earn = bet * rm;
      G.pot += earn;
      updateHUD();
      burst(tx, ty, 40, ['#ce93d8','#aa00ff','#00c8ff','#ffd600'], 4, 0.016, 0.07);
      addFloat(tx, ty - CS * 0.32, `+$${earn}`, '#ce93d8');
      msg = `🌀 異次元：×${rm}！能量池 +$${earn}`;
    } else {
      burst(tx, ty, 18, ['#5c0080','#9900bb'], 1.8, 0.025, 0.05);
      msg = '🌀 異次元：空間扭曲，無獎勵...';
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
  burst(tx, ty, 60, ['#00ff88','#ffd600','#00c8ff','#aaffdd'], 5, 0.008, 0.05);
  showBig(`+$${cashVal.toLocaleString()}`, '#00ff88', 2200);

  const potWas = G.pot;
  G.pot = 0; G.laps = 0; G.canCashOut = false;
  hideCashBtn();

  setStatus(`✅ 傳送成功！$${potWas.toLocaleString()}${mult > 1 ? ' ×' + mult.toFixed(1) : ''} → $${cashVal.toLocaleString()} 入帳`);
  updateHUD();
}

// ── 遊戲結束 ──────────────────────────────────────────────────
function gameOver() {
  document.getElementById('over-sub').innerHTML =
    `共贏取 <strong style="color:#00ff88;font-family:monospace">$${G.totalWon.toLocaleString()}</strong> 星幣`;
  document.getElementById('overlay').classList.remove('hidden');
}

function restart() {
  Object.assign(G, {
    balance:1000, pot:0, betIdx:2, position:0,
    laps:0, canCashOut:false, animating:false, totalWon:0,
  });
  PS.length = 0; FT.length = 0; BT = null;
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('roll-btn').disabled = false;
  document.getElementById('dice-wrap').classList.add('invisible');
  hideCashBtn();
  setStatus('準備好了嗎？按下發射！');
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
      ? `🛸 傳送入帳 $${cashVal.toLocaleString()} (×${mult.toFixed(1)})`
      : `🛸 傳送入帳 $${cashVal.toLocaleString()}`;
  document.getElementById('cash-btn').classList.remove('hidden');
}

function hideCashBtn() {
  document.getElementById('cash-btn').classList.add('hidden');
}

function autoAdjustBet() {
  while (G.betIdx > 0 && G.balance < BET_LEVELS[G.betIdx]) G.betIdx--;
  document.getElementById('bet-val').textContent = '$' + BET_LEVELS[G.betIdx];
}
