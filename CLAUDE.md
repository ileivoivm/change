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

### ☐ M3 — 里級下鑽
- [ ] 載入新北里界 GeoJSON
- [ ] voxel 化約 1,032 個里
- [ ] 效能調校（InstancedMesh）

### ☐ M4 — 歷史時間軸
- [ ] 爬 1994~2022 歷屆台北縣長 / 新北市長選舉
- [ ] 里界跨年度對齊邏輯
- [ ] 年份 slider + 平滑轉場

### ☐ M5 — 擴張到全台
- [ ] 其他直轄市與縣市
- [ ] 中央與地方切換視圖

### ☐ M6 — 開票日即時
- [ ] 研究當年中選會即時 endpoint
- [ ] 即時 polling + 動畫刷新

---

## 工作慣例

- **單一來源**：所有決策、里程碑進度更新於本檔，其他臨時筆記別散落各處
- **資料快取**：抓下來的選舉原始資料存入 `data/raw/`，清洗後存 `data/processed/`
- **逐步驗證**：每完成一個里程碑，先 demo 給用戶看過再往下
- **美學迭代**：視覺不要求一次到位，會隨開發反覆調整
- **預覽一律用 MCP Chrome**：驗證畫面時使用 `mcp__Claude_in_Chrome__*` 工具（導航 → 截圖 → 讀 console），**不要**使用 Launch preview 面板
- **回覆收尾語**：每次回答完問題、收尾一輪工作時，最後一句用中文寫「**已完成**」作為明確結束訊號
