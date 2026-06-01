# 星際賭場 — 開發文件

單人博彩棋盤遊戲，外星人主題，純前端（HTML/CSS/JS），無需伺服器。

## 專案結構

```
monopoly/
├── index.html   # 頁面結構
├── style.css    # 樣式（外星暗色主題）
├── game.js      # 遊戲邏輯 + Canvas 繪圖 + 粒子特效
└── audio.js     # Web Audio API 背景音樂與音效
```

## 開發與預覽

```bash
# 本地啟動
python3 -m http.server 8899
# 開啟 http://localhost:8899/
```

## 部署

- **GitHub Pages**：`git push` 後自動更新
- **線上網址**：https://maxwinwin69.github.io/monopoly-demo/

## 遊戲玩法

1. 設定下注星幣（$10 ~ $500）
2. 按「🚀 發射」擲骰子，棋子沿 16 格棋盤移動
3. 落在房子格獲得獎金（×1 ~ ×8），加入**宇宙能量池**
4. 落在黑洞/蟲洞格扣除星幣餘額
5. 經過或落在**星際基地（出發點）**可選擇「🛸 傳送入帳」領取獎池
6. 繼續不領取可累積**繞圈倍率**（×1.5、×2.0…），但風險越高

## 棋盤格子（16 格）

| ID | 名稱 | 類型 | 效果 |
|----|------|------|------|
| 0 | 星際基地 | start | 可提領獎池 |
| 1,9,15 | 隕石坑 | prize | 獎池 +×1 |
| 5 | 外星基地 | prize | 獎池 +×2 |
| 2 | 能量水晶 | prize | 獎池 +×3 |
| 8 | 暗物質 | prize | 獎池 +×3 |
| 13 | 外星文明 | prize | 獎池 +×3 |
| 14 | 宇宙寶藏 | prize | 獎池 +×4 |
| 6 | 超新星 | prize | 獎池 +×5 |
| 10 | 宇宙爆炸 | jackpot | 獎池 +×8 💥 |
| 3,11 | 異次元 | random | 隨機 ×0~5 |
| 4,12 | 黑洞 | danger | 餘額 -×1 |
| 7 | 蟲洞 | danger | 餘額 -×2 |

## 繞圈倍率

| 圈數 | 提領倍率 | 中央面板顏色 |
|------|---------|-------------|
| 0–1 | ×1.0 | 綠 |
| 2 | ×1.5 | 黃綠 |
| 3 | ×2.0 | 黃 |
| 4 | ×2.5 | 橘 |
| 5+ | ×3.0+ | 紅（高風險警示）|

## 技術細節

### game.js 主要函數
- `draw()` — 每幀繪製棋盤、棋子、特效
- `drawCenter()` — 中央獎池面板，依圈數縮放與換色
- `drawToken()` — 外星綠色棋子（含旋轉軌道環）
- `animateMove(steps)` — 棋子逐步移動動畫
- `resolveSpace(passedStart)` — 落點效果處理
- `onCashOut()` — 提領獎金
- `lapColor(laps)` — 依圈數回傳對應顏色

### audio.js
- 所有音效用 Web Audio API 即時合成，無外部音檔
- `AUDIO.init()` — 首次互動時建立 AudioContext
- BGM：A 五聲小調琶音 + 低音 + 和弦墊音，自動循環
- SFX：骰子、移動、獲獎、大獎、危險、提領等

### 粒子系統（game.js）
- `PS[]` 陣列統一管理所有粒子
- `burst(x,y,n,colors,speed,decay,grav)` — 爆炸粒子
- `coinShower(count)` — 金幣從頂部落下
- 圈數 ≥ 2 時，中央面板自動噴出環境火花

## Git 工作流程

```bash
# 修改後推送
git add -A
git commit -m "說明"
git push
```
