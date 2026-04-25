# CHANGE — 分工與待辦

> **使用規則**：開始做某個 task 前，先在「進行中」區標記（附 session 名稱或日期），避免撞車。完成後把 checkbox 打勾，並移到「完成紀錄」。每個 session 開始前先讀這份文件。

---

## Session 名稱對照

| 代號 | 說明 |
|---|---|
| **小A** | 先開的 session，負責台北市選舉資料、高雄補選、Stage 1 首頁 MVP |
| **小B** | 後開的 session（peaceful-heyrovsky worktree），負責 Stage 0 桃園/台中/台南/codebook |

---

## 進行中的工作

| Session | 日期 | 工作內容 |
|---|---|---|
| 小A | 2026-04-25 | ✅ Stage 1 完成。下一步待認領 |
| 小B | 2026-04-25 | ✅ Stage 3 台北市完成。下一步待認領 |

---

## 待辦事項（可認領）

### Stage 0：六都代碼盤點

- [x] 台北市 ✅ 小A（8 屆 1994–2022，tpe-YYYY-mayor.json 已寫入）
- [x] 新北市 ✅ 已完成
- [x] 桃園市 ✅ 小B（prv=01→03→68，13區，1997/2001/2005/2009縣長+2014/2018/2022市長）
- [x] 台中市 ✅ 小B（prv=03→66，29區，合併前跳過，2010起）
- [x] 台南市 ✅ 小B（prv=04→67，37區，合併前跳過，2010起）
- [x] 高雄市 ✅ 小A（2020補選 khh-2020-mayor.json 已寫入；2010/2014/2018/2022 待 Stage 3）

### Stage 1：首頁 MVP

- [x] 2D Metro 卡片 HTML/CSS 骨架 ✅ 小A
- [x] `?city=` 路由邏輯（ntpc active；其餘即將推出）✅ 小A
- [x] 新北頁左上加「← 六都」chip ✅ 小A
- [x] 舊 `?y=&d=&v=` share URL 向下兼容（自動補 city=ntpc）✅ 小A

### Stage 2：資料管線通用化

- [x] `extract-elections.mjs` ✅ 小B（--city tpe/ntpc/tyc/txg/tnn/khh/all，30場選舉全通過）
- [x] `extract-villages.mjs` ✅ 小B（--city flag，六都邊界+里票全通過）
- [x] `src/main.js` 抽 city config ✅ 小B（CITY_CONFIGS + CITY_CONFIG，?city= 路由，ntpc 向下兼容）

### Stage 3：依序打亮六都

- [x] 台北市 ✅ 小B（12 區彩色 voxel、8 屆 1994-2022、里級全年份、村數/得票率標籤、動態 hint 文字）
- [ ] 桃園市（13 區）
- [ ] 台中市（29 區，2010 合併後）
- [ ] 台南市（37 區，2010 合併後）
- [ ] 高雄市（38 區，2010 合併後）

### Stage 4：首頁升級

- [ ] voxel 全台 backdrop + 卡片浮層（C 方案）

### 其他待辦

- [ ] M3 延後：點擊區顯示詳細資訊面板（等資料接入後）
- [ ] M3 延後：相機 focus/縮放到點擊區
- [ ] M10：研究中選會即時 endpoint（開票日用）
- [ ] M10：即時 polling + 動畫刷新
- [ ] 並排比較模式（例 永和 vs 中和）

---

## 完成紀錄

| 日期 | Session | 內容 |
|---|---|---|
| 2026-04 | — | M1 MVP 骨架（Vite + Three.js + OrbitControls） |
| 2026-04 | — | M2 區級 voxel 渲染（2,473 方塊，台北縣 29 區 + 台北市 context layer） |
| 2026-04 | — | M3 基礎互動（氣泡標籤、指南針、zoom 控制） |
| 2026-04 | — | 區界線 + 全台灣 voxel 地圖（三層架構、白/黑邊界線） |
| 2026-04 | — | M4 2022 新北市長選舉資料接入（29 區 margin 配色） |
| 2026-04 | — | M5 歷史時間軸（1997–2022 七場選舉，底部時間軸 UI） |
| 2026-04 | — | M6 里級下鑽 + 左側清單（987 里 polygon，1,032 筆 2022 里票數） |
| 2026-04 | — | M6.5 點區下鑽互動（相機 pan + zoom，四種退出方式） |
| 2026-04 | — | M6.6 左側清單三層導航（新北市 → 區 → 里） |
| 2026-04 | — | M7 視覺強化 + 歷屆里級 + URL 分享（pulseMesh、?y=&d=&v= 參數） |
| 2026-04 | — | M8 手機互動修復（cardsCollapsed 狀態、touch-action、z-index） |
| 2026-04 | — | Stage 0：新北市 CEC 代碼盤點完成 |
| 2026-04-25 | 小A | 台北市 1994–2006 直轄市長 CSV 下載 + extract-tpe-elections.mjs；8 屆 tpe-YYYY-mayor.json 完成 |
| 2026-04-25 | 小A | 高雄市 2020 補選從 CEC API 抓取；khh-2020-mayor.json 完成（38 區，陳其邁 DPP） |
| 2026-04-25 | 小B | Stage 0：桃園/台中/台南 CEC 代碼盤點 + six-cities-codebook.json |
| 2026-04-25 | 小A | Stage 1：首頁 Metro 卡片、`?city=` 路由、`← 六都` chip、舊連結向下兼容 |
| 2026-04-25 | 小B | Stage 2-1：extract-elections.mjs 通用化（--city flag，六都30場選舉全通過） |
| 2026-04-25 | 小B | Stage 2-2：extract-villages.mjs 通用化（--city flag，六都邊界+歷屆里票全通過） |
| 2026-04-25 | 小B | Stage 2-3：src/main.js 抽 city config（CITY_CONFIGS export、CITY_CONFIG 路由、build 驗證通過）|
| 2026-04-25 | 小B | Stage 3 台北市：?city=tpe 完整渲染（12 區 voxel、8 屆時間軸、里級全年份、新北 context 層）|
