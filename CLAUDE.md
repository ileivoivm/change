# CHANGE — 台灣選戰版圖視覺化

以 Three.js 打造 Minecraft / voxel 風格的互動網站，呈現台灣市長（縣長）選舉歷屆藍綠白版圖變化。從新北市出發，逐步擴大到全台，最終目標為開票日直連中選會即時顯示結果。

---

## 核心原則

- **最小可行優先**：每個階段都要能跑、能看、能驗證，再往下一步
- **逐步解決**：避免一次處理過多層級，先 MVP 再擴張
- **數據不預設立場**：保存各黨派原始得票率，視覺層才處理「藍綠白」詮釋

---

## 專案範圍決策

| 項目 | 決定 | 備註 |
|---|---|---|
| 時間起點 | **1994** | 1994 以前資料殘缺、跳過 |
| 地理起點 | 新北市（前身台北縣） | 台北縣 1994~2010，升格後為新北市 2010~ |
| 政治分類 | 不只藍綠，**保留各黨派原始得票** | 第三勢力（民眾、時力、親民、新黨、無黨）獨立呈現 |
| 視覺風格 | **Minecraft voxel / 方塊風** | 讓人一看心情好 |
| 最小單位 | 里 → 區 → 市 | 可下鑽的層級 |

## 視覺參考

- [Townscaper](https://www.townscapergame.com/) — 柔和色票、方塊堆疊美學
- [Minecraft Earth](https://www.minecraft.net/earth) — 鳥瞰 voxel diorama
- [Kubota Future Cube](https://www.kubota.com/futurecube/) — **審美參考**（低飽和、乾淨幾何、柔光 AO），但其技術為 sprite 2.5D、**不適用**本專案動態需求

---

## 技術路線

### 前端
- **Three.js + InstancedMesh**：一次畫幾千個方塊仍順暢
- **Vite**：開發伺服器
- **OrbitControls**：鳥瞰 + 旋轉
- **Raycast**：hover / click 選區

### 資料管線
- **行政區界**：[ronnywang/tw-boundary](https://github.com/ronnywang/tw-boundary) GeoJSON
  - ⚠️ 里界會逐年調整，資料需按選舉年份對齊
- **選舉結果**：
  - 中選會選舉資料庫 `db.cec.gov.tw`（需爬，無官方 REST API）
  - `data.gov.tw` 搜「選舉」
- **座標轉換**：TWD97 → WGS84（若來源為 TWD97）

### voxel 化策略
- 每個里 → 一疊方塊
- 方塊顏色 → 主導黨派（可切換：最高票黨 / RGB 混色 / 得票差熱度）
- 方塊高度 → 可切換（投票率、票差、總票數）

---

## 里程碑

### ✅ M1 — MVP 骨架
- [x] Vite + Three.js 專案建立
- [x] OrbitControls 可旋轉查看

### ✅ M2 — 區級 voxel 渲染
- [x] 載入 g0v/twgeojson 的 twTown topojson
- [x] 前處理：抽出 台北縣(29區) + 台北市(12區) 合併 MultiPolygon
- [x] 投影 lon/lat → 世界 XZ，polygon → voxel grid（cell=0.45, height=0.9）
- [x] InstancedMesh 一區一 mesh，柔和 Townscaper 色票（2,473 方塊）
- [x] 台北市以半透明灰矮方塊當 context layer（填補中間的洞）
- [x] 滑鼠 hover 高亮（emissive + Y 抬升）+ HUD 顯示區名

### ✅ M3 — 基礎互動強化
- [x] 區名標籤以白底氣泡 + 針腳形式浮在方塊上方（HTML overlay 跟隨 centroid）
- [x] 指南針（右上角，紅針隨相機旋轉）
- [x] 點擊指南針 → 補間到正北朝南俯瞰
- [ ] 點擊區顯示詳細資訊面板（延後至有資料後）
- [ ] 相機 focus/縮放到點擊區（延後）

### ✅ 區界線 + 全台灣 voxel 地圖
- 三層架構（統一的 `voxelOwner` Map）：
  - `ntpc` 層：新北市 29 區彩色方塊（選舉配色）
  - `tpe` 層：台北市 12 區灰色半透明矮格
  - `rest` 層：全台其他 336 鄉鎮市區灰色矮格（含離島 40,722 格）
- 邊界線雙色策略：
  - **白色線**：區與區交界（`voxelOwner` 有值但 townKey 不同），但 rest 層內部不畫
  - **黑色線**：海岸線 / 外緣（`voxelOwner` 無值 = 海外）
- 右上角控制群組：羅盤 + zoom +/- + home（初始視角）
- 霧減半（`Fog(80→360)` → `Fog(120→720)`）以利拉遠檢視全島

### ✅ M4 — 2022 新北市長選舉資料接入
- [x] 資料源：[kiang/db.cec.gov.tw](https://github.com/kiang/db.cec.gov.tw) voteData/2022-111年地方公職人員選舉/C1/prv（CEC 原始格式 elbase/elctks/elcand/elpaty）
- [x] 前處理腳本 `scripts/extract-election-2022.mjs` → `data/processed/ntpc-2022-mayor.json`
- [x] 區名對齊：GeoJSON 用 1982 台北縣名（鄉/鎮/市），選舉資料用 2022 新北區名 → 以前兩字 stem 匹配
- [x] 配色政策：色相永遠是**勝方政黨色**（絕不用敗方色），margin 驅動飽和度。margin=0 → 淡化的勝方色；margin ≥ 20% → 純勝方色；中間以 sqrt 曲線使 1% 小勝也能明顯看到勝方色傾向
- [x] 政黨色：KMT #2060b0、DPP #2aa046、TPP #3bb5c4、時代力量 #e6a61f、無黨 #aa9478
- [x] Bubble 顯示候選人、政黨、得票率與 winner margin

### ✅ M8 — 手機互動修復（卡片 vs OrbitControls 交互）

手機版從「可以轉鏡頭」→「不能轉」的退化來自幾個相依的改動，踩坑順序：

1. **`a66c843` 加手機 RWA**：原本桌面 5 欄 × 180px 卡片在手機上會溢出畫面，使用者手指能從卡片間的空白抓到 canvas → 可以轉。改成 3 欄填滿寬度後，卡片覆蓋整個 viewport，`pointerdown` 全被 `pointer-events:auto` 的 `.card` 吃掉 → OrbitControls 收不到事件 → 轉不了
2. **`84e83b2` drilled mobile scroll overlay**：為了讓 126 個里不超出螢幕加了 `body.drilled #village-list { pointer-events: auto; touch-action: pan-y }`，drilled 狀態下中段螢幕完全被吃
3. **分享按鈕穿透**：`#label` 沒設 z-index，手機上被 `#village-list`（DOM 順序較後）蓋掉，連 `pointer-events:auto` 的 share-btn 也點不到

#### 修復策略（四層）

**Layer 1：canvas 必備 `touch-action: none`**
Three.js OrbitControls 在行動裝置上靠這個屬性搶下觸控手勢；沒設的話瀏覽器預設會用系統手勢吞掉 pointer event。

**Layer 2：`cardsCollapsed` 從「top-level 專用」升級成通用 UI 狀態**
原本只在頂層 Space 切換。現在 top-level / drilled 兩種模式都用同一個 state，CSS 用 `body.cards-collapsed:not(.drilled)` vs `body.cards-collapsed.drilled` 決定要隱藏哪一層卡片（區格 or 里格）。`.compact` breadcrumb chip 永遠不被隱藏。

**Layer 3：手機預設 collapsed，觸發點分兩層**
- `let cardsCollapsed = isMobile()` — 行動裝置開啟時就收合，使用者看到地圖先
- `selectVillage` 在手機上強制 `cardsCollapsed = true` — 走卡片點進里、bubble 釘住後，自動把里格收起、讓地圖重新可轉（走 map voxel 點進來時，因為原本就 collapsed 所以沒事，這邊補齊）
- `drillInto` / `exitDrill` **不動** `cardsCollapsed` — 保留使用者當前偏好，避免「點 新北市 展開區卡 → 點區 → 里格被默默關掉」的 bug

**Layer 4：Breadcrumb chip 三種語義**
`[新北市] [三重區] [中興里]` 三階，chip 點擊行為分層：

| chip | 沒 drill | drilled + 沒選里（2 階） | drilled + 有選里（3 階） |
|---|---|---|---|
| 新北市 | `toggleCardsCollapsed` | `exitDrill` 回頂層 | `exitDrill` 回頂層 |
| 區 | `drillByStem` 進該區 | `toggleCardsCollapsed` 切換里格（旋轉模式） | `unselectVillage` + 手機上重展里格（回 2 階）|

關鍵點：區 chip 在 3 階狀態要「順間回到 2 階」（unstick bubble + 重顯里格），不是單純 toggle collapse 否則 bubble 還掛著使用者以為沒反應。

**Layer 5：`#label { z-index: 50 }`**
Bubble 疊在 `#village-list` 上，share-btn 才點得到。`#village-list` 的 `pointer-events:none`（collapsed 時）+ bubble `z-index:50`（always）兩個獨立機制合流確保 share-btn 在任何狀態下都能點。

#### 測試路徑（手機上要全過）

1. 開站 → 看到地圖 + 頂部「新北市」chip → 可旋轉 ✓
2. 點「新北市」→ 29 區格展開
3. 點某區（例 三重）→ drill，里格展開
4. 點某里（例 中興）→ bubble 釘住 + 里格自動收起 + 地圖可旋轉 ✓
5. 點「三重區」chip → bubble 收掉 + 里格重展（回 2 階）
6. 再點「三重區」chip → 收合里格（旋轉模式）
7. 點「新北市」chip → 回頂層
8. 2022 里 bubble 的「複製分享連結」按鈕可點 ✓

### ✅ M7 — 視覺強化 + 歷屆里級 + URL 分享
- **選中發光**：`pulseMesh` + sin 波 emissive（金色 0xffc966）+ Y 抬升；drill 進入時 1.1s 短暫 flash 全區 villages
- **里級 1997–2022**：`scripts/extract-villages.mjs` 擴充為多年份；2005 起 CEC 有里級（2005=1014、2010~2022=1032），1997/2001 CEC 未公開里級（面板顯示「無里級資料」）
- **切年同步更新 villages**：`setYear` 同時 tween 里 voxel 顏色 + 重建左側面板；`tickColorTween` 擴及 villageMeshes
- **URL 分享**：`?y=YYYY&d=stem&v=stem` 寫入 history.replaceState；頁面載入時 `parseAndApplyUrl` 還原 year / drill / village 選取
- **TDZ 修正**：`hovered` 提前宣告到早期 state block，避免 bootstrap 時 setYear 先訪問

### ✅ M6.6 — 左側清單三層導航
- 點「新北市」header → 回全局 home（dist 108）
- 點區名（例 中和區）→ drill 到該區（dist 14，隱藏其他 28 區）
- 點里名（例 安平里）→ 再 zoom 到該里（dist 10），bubble 自動 pinned 顯示票數
- Bubble 固定顯示用 `sticky` 旗標，滑鼠移動不覆蓋；點空地 / 按 ESC / 點另一里會 unstick

### ✅ M6.5 — 點區下鑽互動
- **點擊 NTPC 區** → 自動進入該區里模式（隱藏其他 28 區）+ 相機保持角度、pan + zoom 到該區 centroid（dist=14）
- 左側面板：自動摺疊其他區、展開選中區、高亮區頭
- 退出方式（四擇一）：
  - 點擊空地（raycast 未命中里）
  - Home 按鈕
  - ESC 鍵
  - 右上角 toggle（區模式）
- Click / drag 區分：`pointerdown → pointerup` 移動 < 4px 且 < 450ms 才當作 click
- 里級只有 2022 — 切換年份自動退回區模式，進入里模式自動跳 2022

### ✅ M6 — 里級下鑽 + 左側清單
- `data/raw/twVillage.topo.json` → `ntpc-villages.geo.json`（987 里 polygons）
- 2022 里級票數：`ntpc-2022-villages.json`（1,032 筆，用 CEC elctks village 行抓）
- 名稱對齊：GeoJSON 用 1982 村名（村/里），2022 都已改為里 → 以 `townStem + villageStem` 匹配（971/987 命中率）
- Village voxel 層：獨立 `THREE.Group`，cell=0.20（比區 0.45 細），自帶白/黑邊界線，預設 `visible=false`
- 右上角 `區↔里` toggle 按鈕：切換顯示 NTPC 區級 or 里級 voxel
- 左側面板：29 區 headers + 里列表（點擊區 head 展開）。每里一行：色塊 + 里名 + 得票差 %
- 年份/模式耦合：里級僅 2022 資料，切換其他年份時自動退回區模式，切到里模式時自動跳回 2022

### ✅ M5 — 歷史時間軸
- 資料涵蓋 7 場選舉：
  - 1997 台北縣長 14屆（蘇貞昌 DPP 40.67% — 六人混戰）
  - 2001 台北縣長 15屆（蘇貞昌 DPP 51.31%）
  - 2005 台北縣長 16屆（周錫瑋 KMT 54.87% — 翻盤年）
  - 2010 新北市長 1屆（朱立倫 KMT 52.61% — 升格首任）
  - 2014 新北市長 2屆（朱立倫 KMT 50.06%）
  - 2018 新北市長 3屆（侯友宜 KMT 57.15%）
  - 2022 新北市長 4屆（侯友宜 KMT 62.42%）
- 2009 無資料（台北縣因即將升格未舉辦，周錫瑋延任至 2010-12-24）
- 統一 CEC 原始資料爬取 `scripts/extract-elections.mjs`（處理兩種 CSV 格式：plain 與 quoted `"'XX"`）
- 台北縣（prv=01,city=001）、新北市（prv=65,city=000 / 2010 prv=02）代碼差異以 county 名稱動態定位
- 29 區 stem（前兩字）跨 7 年完全對齊，無需邊界 fallback
- 底部時間軸 UI：7 個節點 + 當選者/黨派縮寫，點擊跳年 → 材質 color lerp（600ms easeOutCubic）
- HUD 標題、hover bubble 跟著年份切換

### ☐ M9 — 六都擴張

拍板決策（2026-04）：

| 決策 | 選擇 |
|---|---|
| 範圍 | **六都**（台北、新北、桃園、台中、台南、高雄）|
| 合併前資料 | **先跳過**（台中/台南/高雄縣+市分開那段不呈現，2010 起看合併後）|
| 首頁形式 | **先 A（2D Metro 卡片 MVP）→ 後 C（voxel 全台 backdrop + 卡片浮層）** |
| 路由 | `?city=tpe\|ntpc\|tyc\|txg\|tnn\|khh` |
| 展開順序 | 台北 → 新北 → 桃園 → 台中 → 台南 → 高雄 |

- [x] **Stage 0**：六都代碼表 + 資料來源盤點 ✅（2026-04-24 完成）
  - 台北市 8 屆（1994–2022）→ `tpe-YYYY-mayor.json`（scripts/extract-tpe-elections.mjs）
  - 高雄 2020 補選 → `khh-2020-mayor.json`（scripts/extract-khh-2020-byeelection.mjs，CEC BEL API）
  - raw CSV：`data/raw/1994-直轄市長/`…`2006-直轄市長/`（kiang GitHub 下載）
  - TODO.md：多 session 協作用，每個 session 開始前必讀
- [x] **Stage 1**：首頁 MVP（A 方案，2D Metro 卡片）+ `?city=` 路由 + 現有新北頁左上加「← 六都」chip ✅（2026-04-25 小A）
  - 首頁：6 城市 Metro 卡片，新北 active，其餘「即將推出」
  - URL 路由：`?city=ntpc` → ntpc 場景；無 city param → 首頁；舊 `?y=&d=&v=` 向下兼容
  - `#city-back-btn`「← 六都」chip 固定在城市頁左上角，點擊回首頁
  - `writeUrl()` 現在永遠包含 `city=ntpc`，確保分享連結帶 city param
- [x] **Stage 2**：資料管線通用化 ✅（2026-04-25 小B）
  - `extract-elections.mjs`：`--city` flag，六都 31 場選舉全通過
  - `extract-villages.mjs`：`--city` flag，六都邊界 + 歷屆里票全通過
  - `src/main.js`：CITY_CONFIGS + CITY_CONFIG，`?city=` 路由，ntpc 向下兼容
- [x] **Stage 3-1 台北市** ✅（2026-04-25 小B）：12 區彩色 voxel、8 屆 1994-2022、里級全年份
- [x] **Stage 3-2 桃園市** ✅（2026-04-25 小B）：13 區、7 屆 1997-2022 含縣長時期、里級 2005+
- [x] **Stage 3-3 台中市** ✅（2026-04-25 小B 實作 / 2026-04-26 小A 驗證）：29 區（txg-districts.geo.json）、4 屆 2010-2022、stem slice(0,2) 修正 2 字地名；驗證：2010 KMT→2014 DPP→2018 KMT→2022 KMT、西屯 39 里、bubble 惠來里
- [x] **Stage 3-4 台南市** ✅（2026-04-25 小B 實作 / 2026-04-26 小A 驗證）：37 區（tnn-districts.geo.json）、4 屆 2010-2022、stem 37/37 對齊；驗證：四屆全 DPP、歸仁 21 里、bubble 永綠里
- [x] **Stage 3-5 高雄市** ✅（2026-04-25 小B 實作 / 2026-04-26 小A 驗證）：38 區（khh-districts.geo.json）、4 屆 2010-2022、三民鄉→那瑪夏區 rename 修正 stem 衝突；驗證：2010/2014 陳菊 DPP→2018 韓國瑜 KMT→2022 陳其邁 DPP、鳳山 76 里、bubble 文英里
- [x] **首頁背景圖** ✅（2026-04-25 小A）：`public/taiwan.png` voxel 台灣島；`#home-screen` 背景改 `#c5bdb1` 精確匹配圖片底色；桌機 `position:absolute; right:0; top:0; height:100vh` 全高貼右；左邊 28% 漸層遮罩淡入；手機 `position:static` 置中顯示於 footer 下方
- [ ] **Stage 4**：首頁升級成 C 方案（voxel backdrop + 卡片浮層）
- [ ] 並排比較模式（永和 vs 中和）候選

### 調色盤修正（2026-04-25 小B）
- `CLOSE_WHITE_MIX` 0.75→0.55：低 margin 顏色不再幾乎不可見
- 柯文哲特例 → TPP 青藍 `#3bb5c4`；黃珊珊加入 TPP 特例
- `candidateColor(name, partyCode)` helper：候選人名稱優先查特例表，再 fallback partyCode

### ✅ M11 — Share Tower（分享塔，2026-04-26）

讓被分享的里在地圖上長出「塔」（細線 + 頂端圓球），分享越多塔越高，達到門檻才會顯現。設計目的：路過民眾看到遠處高塔會好奇「那是哪一個里」，進而探索；沒被分享的里完全不畫塔，讓沉默是沉默、被點亮才發聲。塔顏色刻意中性（暖白），不延伸藍綠對抗。

協作分工（見 `SHARE_TOWER_TODO.md`）：

| Session | 角色 | 完成項目 |
|---|---|---|
| 小C | 後端 | T0：Cloudflare Worker + KV namespace + wrangler 部署 |
| 小B | 前端 | T1–T4：分享流程 / 計數讀取 / 塔渲染 / 互動 |
| 小A | 驗證 | T0 預驗證 + 部署後 E2E + merge 修復 + 補強 |

**T0 後端基礎建設（小C）**
- `worker/src/index.js`：POST `/tally` 寫 share/view 事件、GET `/counts?city=xxx` 讀回該城市聚合計數
- KV key 設計：`agg:{city}` 單一聚合 value，內容為 `{ "{city}-{district}-{village}": {shares, views, lastUpdate} }`；舊 per-village key 由 `loadAgg()` lazy migrate
- 防刷：Worker 端用 IP SHA-256 hash 做 `lock:{city}-{district}-{village}:{ipHash}`，正式站 TTL 24 小時；同一 IP 對同一里一天只計一次（share/view 共用），localhost dev origin 旁路
- `/counts` 使用 Cloudflare Cache API，依 city + origin 快取 60 秒；分享成功後前端做本地樂觀 +1，不再按分享後重抓整城 counts
- Daily cron decay：每天每筆 `shares` 與 `views` 各 -1，歸零後從 agg 移除
- CORS 白名單：`https://ileivoivm.github.io`（production）+ `localhost:5173/5200` + `127.0.0.1:5173/5200`（dev E2E）
- Endpoint：`https://change-tw.ileivoivm.workers.dev`
- KV namespace ID：`fb9b871a0c8e4a9595b27da13fdf2106`

**T1 前端分享流程（小B + 小A 補強）**
- bubble 內 `.share-btn`：**全平台 clipboard**（手機 navigator.share 拿掉，使用者反映 iOS sheet 太突兀）
- 三段 fallback：clipboard API → execCommand textarea → button 顯示「複製失敗 · 再試一次」（不再彈 prompt popup）
- 按鈕文字「複製分享連結、點亮燈塔」明確說明兩件事（複製 + 後端 +1）
- 分享連結帶 `?ref=share`，`scripts/build-share.mjs` 重定向時保留 query；2022 六都統一 `/share/{city}/{d}/{v}/?ref=share`，新北 legacy `/share/2022/{區}/{里}/` 雙寫向後相容（FB 30 天 cache 不失效）
- 點分享按鈕 → `POST /tally {event:'share'}` + 76 顆粒子煙火（暖黃→暖橘調色盤）
- 頁面載入 `parseAndApplyUrl` 偵測 `?ref=share` → `POST /tally {event:'view'}`
- 防刷：sessionStorage 30 分鐘鎖（`tally_lock:{event}:{key}`，dev 跳過）+ keepalive flag 讓跳走也能寫入

**分享 URL 協定風險（長期記憶）**
- 最近多次退化都集中在分享 / OG 路徑：SPA query 沒有 village-specific OG、中文路徑 URL encode、數字 ID 新協定、六都 OG 產生、OG 圖 cityName 曾寫死「新北市」。
- 這條鏈路是高風險核心，不可再只靠手動發現。之後凡改 `scripts/build-share.mjs`、share button URL、`parseAndApplyUrl`、`?ref=share` tally、OG meta / image path，都要先對照明確規格並跑測試案例。
- 最小測試矩陣：ntpc legacy 中文 URL、六都數字 URL、中文 stem fallback、SPA `?city=&y=&d=&v=&ref=share` 還原、crawler 可讀 OG meta、人類瀏覽器跳回 SPA 且保留 `ref=share`、非 ntpc 城市 OG 圖 cityName / mayorRole 正確。

**T2 計數讀取與聚合（小B）**
- `fetchShareCounts()` 城市載入時非同步呼叫 GET /counts
- `window.shareCounts` / `districtShareCounts` 提供 debug 與塔渲染使用
- `getTotalForVillage(townName, villageName)` → share + view 總和

**T3 塔的視覺渲染（小B + 小A 補強，InstancedMesh）**
- `buildTowerIM()`：shaft `CylinderGeometry` r=**0.025**（半粗）+ top `SphereGeometry` r=0.15 (12 segments)
- shaft 用 MeshStandardMaterial emissive `#fff5d6` × 0.5（柔和），top 用 MeshBasicMaterial 永遠滿亮（`toneMapped:false, fog:false`）讀作燈籠
- **離散階梯高度**：每 10 次升 1 階、每階 1.0 unit、上限 `TOWER_MAX_LEVEL=10`（取代原 log 縮放）
- 里級塔：filter `count ≥ 10` 才建塔，去重 villageKey 避免離島雙塔
- 區級塔：聚合 ≥ 50 才建塔，但 **高度 / 顏色 / Lv. 一律沿用村級 threshold=10 公式**，避免 LOD 切換時跳動
- LOD：**單一切換點 `dist=50`**（之前 40-60 重疊區會雙塔已修），近景村塔、遠景區塔
- District tower 位置採該區已點亮 villages 的 **count-weighted 平均**，避免拉遠時位置跳到行政中心
- **顏色漸變**：count=10 暖黃 `#FCE327` → count=100 暖橘 `#FC8654` 線性 lerp（per-instance setColorAt）
- **星光閃爍**：`tickTowerTwinkle` 每幀 brightness 0.4–1.0 modulation，每顆隨機相位 + 2–6s 週期
- **voxel 連動**：`tickTowerLift` 跟著 hover lift / pulse breathing 上下，跳過未變 lift 的紀錄
- **drilled 隱藏**：drilled 進某區後其他區的村塔自動 `scale 0`

**T4 互動（小B）**
- `checkTowerHit()` 優先偵測塔 → `setHover(towerGhost)` 顯示「🏯 Lv.N · 已被分享 N 次」
- `handleCanvasClick()` 點塔 → `selectVillage` / `drillByStem`，**drilled 模式也吃**（之前只在 top-level 觸發已修）
- mobile touch 同步（沿用 raycaster click handler）

**T5 已做的部分**
- [x] OG 卡擴大六都 2022（commit `81053b3`，路徑 `/share/{city}/{d}/{v}/`）
- [x] 時間衰減：Cloudflare cron `5 0 * * *` daily −1，雙 0 自動刪 key
- [x] 分享按鈕煙火儀式感（76 顆粒子，commit `c1a3325`）

**T5 待做** — 見 `SHARE_TOWER_TODO.md`

#### Merge 殘留陷阱（小A 修復紀錄）

小B 在 worktree branch `claude/peaceful-heyrovsky-7a5ef2` commit `1fbeb3f` 完成 T1–T4 後，merge 回 main 時 `selectVillage` 留下兩處 `autoPanForBubble` 處理並存：
1. 我的 `panZoomWithPitch(..., autoPanForBubble)` callback 串法（pitch tween 完成後才接 autoPan）
2. 小B 分支舊版的 `requestAnimationFrame(() => autoPanForBubble())` + 重複 function 宣告

兩者並存導致 `SyntaxError: Identifier 'autoPanForBubble' has already been declared`，整個 SPA 無法啟動。修法：刪重複 function、移除 RAF 呼叫，保留 callback 串法。

### ✅ M12 — 選民結構（內政部 ODRP014 / ODRP020）+ secondary bubble

把純票數視覺再往「結構脈絡」推進一層 — 看到誰贏不只是看誰贏，還能看「這個里是什麼樣的人住在這裡」。

**資料管線（`scripts/extract-villages-demographics.mjs`）**
- 兩個 endpoint 並行抓：
  - ODRP014（`yyymm=11503`，2026-03 月度村里×單一年齡×性別）
  - ODRP020（`yyy=113`，2024 年度村里×教育程度×性別×畢肄業，51 欄壓成 4 桶）
- 兩 dataset 用 `district_code` 串接（同一筆里的兩種觀察）
- 六都共 4,181 筆 villages（ntpc 1,032 / khh 890 / tnn 649 / txg 625 / tyc 529 / tpe 456）
  - 教育命中：ntpc/tpe/txg/tnn/khh 100%、tyc 漏 13 筆 2024 新設里（acceptable）
- 每筆從 210+51 欄壓縮到 ~15 欄：戶數 / 總人口 / 男女 / 選舉人(20+) / 中位年齡 / 4 段年齡桶（0-19, 20-39, 40-59, 60+）/ `education = { total15up, graduate, college, senior, junior }` 4 段教育桶
- 輸出至 `data/processed/{city}-demographics.json`，總 ~1.27 MB（單城最大 ntpc 314 KB）
- COUNTY 參數需用「臺」非「台」（API 嚴格要求）

**UI（拆 bubble）**
- 主 bubble（左）：tag + 里名 + winner + candidates + 差距試算 + 17 年歷史條 + 燈塔 tally + 分享
- secondary bubble（右）：兩段並列
  - 「選民結構」：人口 / 選舉人 / 性別 / 中位年齡 + 4 段水平堆疊年齡條（暖色系：黃→棕→深棕→巧克力）+ 2×2 圖例
  - `<hr class="demo-divider">` 分隔
  - 「教育程度」：中位學歷（從低到高 cumulative 過半的桶）+ 4 段水平堆疊教育桶（冷暖系：研究所 `#5b8def` 藍 → 大學專科 `#7eb6c7` 青 → 高中職 `#a89c7a` 卡其 → 國中以下 `#c98c70` 暖棕）+ 2×2 圖例
  - 資料來源並列：「人口資料：內政部戶政司 11503　／　教育程度：內政部戶政司 ODRP020 113」
- 教育桶分母用 `Math.max(total15up, sum of buckets)` 防資料不一致
- 教育桶 CSS 用 modifier `.age-stack.edu`（沿用 `.age-stack` 結構，覆寫 4 顏色）
- demographicsMap 用 stem 索引（永和區/永和市命名差異不影響）
- 只有 `sticky=true` 且 village 層 + `hasDemo` 才顯示 secondary（hover 時隱藏）
- 鏡像佈局：voxel 在中間，A 在左、B 在右

**Hover 輕量化（同期）**
- 主 bubble 在 `!sticky` 時 → `.minimal` class，只顯示里/區名（38px 高，無候選人/差距/歷史）
- click pin 才升級成完整 bubble + secondary
- 「畫面資訊過多」徹底解：transient hover 完全 minimal，連連莊 X 年都不秀
- 注意：`selectVillage` 內 `sticky = true` 必須在 `setHover` **之前**，否則 renderBubble 走 minimal 分支只畫里名

### ✅ M13 — 跨六都搜尋 + 報告 modal + minimal hover

- **跨六都搜尋**：`/` 或 `Cmd+K` 開 modal，索引 ~5,500 筆（六都 2022 villages + districts）。多 token AND 比對（「永和 安和」要兩 token 都命中）。同城跳轉用 `selectVillage` / `drillByStem` 不重整；跨城用 `location.assign` 觸發整頁路由
- **資料回報 modal**（電話圖示）：免責聲明 + 引用來源（CEC / 內政部 / g0v）+「開新 Issue 通報 ↗」連 GitHub
- **「翻盤」措辭中性化**：bubble flip block 從「X 黨翻盤需 N 票改投」→「侯友宜 與 林佳龍 差距 N 票（X.X% 領先）」+「N 票流動即可平手」+「或多 N 張票進場」。數字算法相同，語氣從動員→事實
- **「連莊 X 年 / 翻過 N 次」文案升級**：bubble 底部 hs-meta 從輕描述升級成五種狀態時序統計（永X里連莊 N 年 / 翻轉里翻過 1 次 / 搖擺里翻過 N 次）

### ☐ M10 — 開票日即時
- [ ] 研究當年中選會即時 endpoint
- [ ] 即時 polling + 動畫刷新

（舊 ☐ M3 里級下鑽 / M4 歷史時間軸 已合併到上方的 M5 / M6，checkbox 清理於 2026-04。）

---

## 工作慣例

- **單一來源**：所有決策、里程碑進度更新於本檔，其他臨時筆記別散落各處
- **多 session 協作**：`TODO.md`（六都本體）+ `SHARE_TOWER_TODO.md`（分享塔功能）是分工協調中樞。兩份檔在 `.gitignore`，本地各自維護，不進 git history（避免暴露 session 狀態 / 工作流細節）。每個 session 開始前先讀對應 TODO，認領工作前在「進行中」標記，完成後打勾移到「完成紀錄」，避免撞車。完成的工作也要同步到 CLAUDE.md（里程碑 checkbox）+ 長期記憶。
- **Session 角色**：小A 驗證 / 小B 實作（peaceful-heyrovsky worktree）/ 小C 後端（Cloudflare Worker / KV / 部署）。小B 通常在 worktree branch 工作，完成後需 merge 回 main；小A 驗證後在 TODO 勾名。
- **資料快取**：抓下來的選舉原始資料存入 `data/raw/`，清洗後存 `data/processed/`
- **逐步驗證**：每完成一個里程碑，先 demo 給用戶看過再往下
- **美學迭代**：視覺不要求一次到位，會隨開發反覆調整
- **預覽一律用 MCP Chrome**：驗證畫面時使用 `mcp__Claude_in_Chrome__*` 工具（導航 → 截圖 → 讀 console），**不要**使用 Launch preview 面板
- **回覆收尾語**：每次回答完問題、收尾一輪工作時，最後一句用中文寫「**已完成**」作為明確結束訊號
- **「已完成」前的同步義務（強制）**：在說「已完成」之前，**先檢查並更新**：
  - `SHARE_TOWER_TODO.md` —「進行中」勾掉 / 移到「完成」、「待辦事項」checkbox 補打、「驗證清單」狀態調整
  - `CLAUDE.md` — 若該變動是「已成立的決策 / 永久里程碑」（不是純粹 bug fix），在對應 milestone 章節補上一段
  - 區分原則：可逆的 bug 修補 → 只動 commit message；改變產品行為 / 介面契約 → 動 CLAUDE.md
  - 觀察到「常常忘記」，所以這條被列為強制 checklist；session 收尾流程：commit → push → 更新 TODO/CLAUDE → 「已完成」
