# 星際大富翁 — 開發文件

單人大富翁博彩棋盤遊戲，外星人主題，純前端（HTML/CSS/JS），無需伺服器。

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

1. 設定投資星幣（$10 ~ $500）
2. 按「🚀 發射」擲骰子，棋子沿 16 格棋盤移動
3. 落在地產格收租並升級房屋（×1 ~ ×8 基礎倍率，隨等級提升）
4. 落在命運卡格進行三選一抽卡，可獲 ×0~×5 倍加成至租金池
5. 落在危險格（太空稅/維修費/歸零危機）扣除租金池，歸零危機還會重置房屋並回到起點
6. 經過或落在**起點基地（出發點）**可選擇「💰 結算租金」領取租金池
7. 繼續不領取可累積**繞圈倍率**（×1.5、×2.0…），但風險越高

## 棋盤格子（16 格）

| ID | 名稱 | 類型 | 效果 |
|----|------|------|------|
| 0 | 起點基地 | start | 可結算租金池 |
| 1,9,15 | 隕石小屋 | prize | 租金池 +×1，升級房屋 |
| 5 | 外星商圈 | prize | 租金池 +×2，升級房屋 |
| 2 | 水晶公寓 | prize | 租金池 +×3，升級房屋 |
| 8 | 暗物質豪宅 | prize | 租金池 +×3，升級房屋 |
| 13 | 文明古城 | prize | 租金池 +×3，升級房屋 |
| 14 | 火箭車站 | prize | 租金池 +×4，升級房屋 |
| 6 | 超新星飯店 | prize | 租金池 +×5，升級房屋 |
| 10 | 銀河地標 | jackpot | 租金池 +×8 💥，升級房屋 |
| 3,11 | 命運卡 | random | 三選一抽卡 ×0~×5 |
| 4 | 太空稅 | danger | 租金池 -×1 |
| 7 | 維修費 | danger | 租金池 -×2 |
| 12 | 歸零危機 | danger | 租金池歸零 + 房屋全重置 + 回到起點 |

## 房屋升級系統

- 每次落在地產格，該地產自動升級一級（最高 5 級 = 飯店）
- 實際收租倍率 = 基礎倍率 + 等級 × 步進（prize: +1/級，jackpot: +2/級）
- 結算租金後所有房屋重置為 0 級
- 結算按鈕顯示目前可領金額：`💰 結算租金 $xxx (×倍率)`

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

**繪圖**
- `draw()` — 每幀繪製棋盤、棋子、特效
- `drawCell(sp)` — 繪製單一格子（2.5D 效果、動態邊框）
- `drawCenter()` — 中央租金池面板（依圈數縮放、換色、旋轉星門）
- `drawToken()` — 外星綠色棋子（含旋轉軌道環）
- `drawHouseLevel(x,y,w,h,sp,th)` — 繪製 3D 等角視角房屋（含窗戶、門、天線、HOTEL 標示）
- `drawMultiplierBadge(cx,cy,mult,th)` — 7 段顯示器風格倍率徽章
- `drawSegmentDigit(x,y,w,h,digit,color)` — 單個 7 段顯示數字
- `drawHazardStripes(x,y,w,h,th,pulse)` — 危險格斜紋紋理
- `drawWarpMark(cx,cy,r,th,now)` — 命運卡格旋轉橢圓標記
- `drawBoardChrome()` — 棋盤外框裝飾（霓虹邊框、旋轉彩燈）

**動畫**
- `animateMove(steps)` — 棋子逐步移動（每步 105ms，留下綠色拖尾粒子）
- `animateDiceRoll(d1,d2)` — 骰子滾動動畫（920ms，含 3D CSS 骰子）
- `setStageDieFace(el,face)` — 設定 3D 骰子最終朝向
- `animateFortuneCard()` — 命運卡三選一互動動畫（抽牌、翻轉、揭曉）
- `pickFortuneOptions()` — 生成三張命運卡選項（pool: 0,0,1,2,3,5）
- `setFortuneCardFace(card,mult)` — 設定命運卡正面顯示內容

**遊戲邏輯**
- `resolveSpace(passedStart)` — 落點效果處理（async，命運卡需 await）
- `onCashOut()` — 結算租金（清空池、重置房屋、重置圈數）
- `onRoll()` — 擲骰子入口（扣注、骰子動畫、移動）
- `cashMult()` — 計算當前提領倍率 `max(1.0, 0.5 + laps × 0.5)`
- `lapColor(laps)` — 依圈數回傳對應顏色

**房產系統**
- `isProperty(sp)` — 判斷是否為地產格（prize 或 jackpot）
- `propertyLevel(sp)` — 取得地產當前等級（`G.houseLevels[id]`）
- `propertyMultiplier(sp)` — 計算實際收租倍率（基礎 + 等級步進）
- `upgradeProperty(sp)` — 升級地產（上限 MAX_HOUSE_LEVEL=5）
- `houseLabel(level)` — 等級文字（空地/N棟房屋/飯店）

**UI**
- `updateHUD()` — 更新頂部星幣與租金池顯示
- `showCashBtn()` / `hideCashBtn()` — 顯示/隱藏結算按鈕（含金額）
- `autoAdjustBet()` — 餘額不足時自動降低下注檔位
- `setStatus(msg)` — 更新狀態欄文字
- `screenShake()` — 觸發棋盤震動動畫

### audio.js
- 所有音效用 Web Audio API 即時合成，無外部音檔
- `AUDIO.init()` — 首次互動時建立 AudioContext
- BGM：A 五聲小調琶音 + 低音 + 和弦墊音，自動循環
- SFX：`dice()` / `diceTick()` / `diceLand()` / `step()` / `prize(n)` / `jackpot()` / `danger(n)` / `random()` / `cashOut()` / `passStart()` / `click()`

### 粒子與特效系統（game.js）
- `PS[]` 粒子陣列：`{x,y,vx,vy,r,color,alpha,decay,grav}`
- `FT[]` 浮動文字：`{x,y,text,color,alpha}`（每幀上移 1.3px）
- `BT` 大字幕：`{text,color,alpha,age,dur}`（淡入淡出）
- `FX` 聚光燈：`{x,y,color,r,alpha,decay}`
- `burst(x,y,n,colors,speed,decay,grav)` — 爆炸粒子
- `coinShower(count)` — 金幣從頂部落下
- `addFloat(x,y,text,color)` — 新增浮動文字
- `showBig(text,color,dur)` — 顯示大字幕
- `flashAt(x,y,color,r)` — 觸發聚光燈特效
- 圈數 ≥ 2 時，中央面板每幀自動噴出環境火花

### 遊戲狀態物件 G
```js
G = {
  balance,      // 星幣餘額
  pot,          // 租金池金額
  betIdx,       // 下注檔位索引（BET_LEVELS: [10,25,50,100,200,500]）
  position,     // 當前格子 ID（0–15）
  laps,         // 繞圈數
  canCashOut,   // 是否可結算
  animating,    // 動畫進行中（防重複點擊）
  totalWon,     // 本局累計贏取
  houseLevels,  // Array(16)，各格房屋等級
}
```

### HTML 特殊元素
- `#dice-stage` — 全螢幕 3D 骰子疊層（`position:fixed`，z-index:50）
- `#card-stage` — 全螢幕命運卡疊層（`position:fixed`，z-index:55）
- `#overlay` — 遊戲結束覆蓋層（z-index:80）
- `.shake` — CSS 動畫 class，觸發棋盤震動

## Git 工作流程

```bash
# 修改後推送
git add -A
git commit -m "說明"
git push
```
