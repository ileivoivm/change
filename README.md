# CHANGE — 台灣選戰版圖

> **點亮一盞燈，照亮未來。**
> 改變從最小的里開始，影響身邊，就能影響大局。

🌐 **線上版**：<https://ileivoivm.github.io/change/>

---

## 為什麼做這個

民主不是每四年才存在一天。它存在於我們對自己住的這條街、這個里、這個區發生過什麼的記憶裡。

但選舉地圖向來只給藍綠兩色的縣市色塊，輸贏一目了然，**過程卻消失了**。住在永和的人不知道隔壁中和怎麼變的；十年前在地的搬家了，新搬來的甚至沒看過這塊版圖以前長什麼樣子。

CHANGE 想讓這份記憶可以被走進去：

- **逐層下鑽**：從台灣 → 六都 → 區 → 里，看到自己住的那一塊
- **跨年回放**：1994 → 2022 七場選舉，里級資料拉回 2005，看「我家這里翻了幾次」
- **正反兩面**：永藍 / 永綠 / 翻轉 / 搖擺，不只看誰贏，看一塊地的政治性格
- **誰差幾票翻盤**：每一里都標出落後方還差多少票就能翻過來，把「沒選上」變成「下次再 N 票」的具體目標

> **改變從最小的里開始。** 一個里也許只有幾百戶，但每個里都是一塊可以被看見、被討論、被翻轉的單位。把焦點從「全國」拉回「我家這條街」，是這個專案的核心。

## 燈塔：分享越多越亮

每個里都有機會在地圖上長出一座發光的燈塔 🏯。

- 你按一次「分享」→ 該里 +1
- 別人從你貼的連結進來看 → 該里再 +1
- 累積到 **10 次** → 燈塔點亮（Lv.1）
- 每多 10 次 → 升一級，最高 Lv.10
- 同一個人對同一個里，每天只計一次（避免單人灌票）
- 沒人持續分享，每天會自動 −1，慢慢矮回去

> **點亮一盞燈，照亮未來。**
> 燈塔不分藍綠，顏色是中性的暖光。它代表的是：「這個里被在乎」。看到遠處有座高塔，會想走過去看那個里在發生什麼。當每一個我們在乎的里都亮起來，整張地圖就成了一張集體關注的星空。

## 歡迎參與

這是一個**公益性、開放原始碼**的選舉資料視覺化專案，以 MIT 授權釋出。製作初衷是讓公民用更直覺的方式認識自己選區的歷史脈絡，不帶任何政治立場、不為任何候選人或政黨背書。

- 🐛 發現 bug、資料誤植、或區里名稱對不上 → 歡迎開 [Issue](https://github.com/ileivoivm/change/issues)
- ✨ 想改善配色、加功能、擴張到其他縣市 → 歡迎送 [Pull Request](https://github.com/ileivoivm/change/pulls)
- 💡 有新的視覺點子或資料來源建議 → 也歡迎 Issue 討論

本專案尊重並遵守中華民國（台灣）法律，包含但不限於《選舉罷免法》、《個人資料保護法》、《著作權法》。所有選舉資料皆取自中選會公開資料，不蒐集、不推斷任何個人投票行為。

---

## 目前支援的六都

| 城市 | 選區數 | 選舉場次 | 年份範圍 | 2022 得票最高者 |
|---|---|---|---|---|
| 台北市 | 12 區 | 8 屆 | 1994–2022 | 蔣萬安 42.3% |
| 新北市 | 29 區 | 7 屆 | 1997–2022 | 侯友宜 62.4% |
| 桃園市 | 13 區 | 7 屆 | 1997–2022 | 張善政 54.8% |
| 台中市 | 29 區 | 4 屆 | 2010–2022 | 盧秀燕 62.7% |
| 台南市 | 37 區 | 4 屆 | 2010–2022 | 黃偉哲 60.9% |
| 高雄市 | 38 區 | 4 屆 | 2010–2022 | 陳其邁 70.0% |

台中 / 台南 / 高雄 採 2010 年縣市合併後邊界，合併前另分縣市的資料不收入。

---

## 功能特色

### 導航與互動

- **三層下鑽導航**：首頁 Metro 卡片 → 城市（區級 voxel）→ 點區 drill → 點里放大 + 釘住票數氣泡
- **Breadcrumb 狀態機**：頂部 `[台北市][大同區][延平里]` 三階 chip，每階點擊行為不同（回上層 / 切換旋轉模式 / 退回二階）
- **退出 drill 四種方式**：點空地 · ESC · Home 按鈕 · 點第一階 chip
- **相機控制**：右上角羅盤（一鍵正北俯瞰）、Zoom +/−、Home（回初始視角）
- **URL 分享**：`?city=tpe&y=2022&d=大同&v=延平` 直接定位任一城市 / 年份 / 區 / 里

### 里級票數氣泡

- 顯示候選人、政黨、票數、得票率（**得票率低於 1% 的候選人自動隱藏**）
- 翻盤所需票數試算（改投票數 vs 新動員票數）
- 勝者 / 落後方以政黨色標示
- 點選里後，攝影機自動上移使氣泡有更多顯示空間

### 歷史 stripe 時間條

- 氣泡底部以色塊呈現同一里在有資料的各屆選舉中的政黨歸屬
- 游標劃過色塊即時跳至該年；click 永久切年
- 自動計算並標示里的政治身分：**永藍里 · 永綠里 · 永白里 · 翻轉里 · 搖擺里**

### 選區配色邏輯

- 色相永遠是勝方政黨色（絕不混入敗方色）
- margin ≥ 20% → 純勝方色；margin ≈ 0 → 淡化（飽和度低）的勝方色；中間線性內插
- 特例：柯文哲（2014/2018 無黨籍）、黃珊珊（2022 無黨籍）視覺上映射至民眾黨藍綠色

### 其他

- **即時色彩過渡**：切換時間軸年份，所有方塊顏色平滑 tween
- **選中發光**：金色呼吸 glow + drill 進入時全區短暫閃爍
- **手機 RWA**：行動裝置預設收合卡片，先看地圖；點里後自動收起里格保留 OrbitControls 手勢空間
- **社群分享卡**：2022 每里預建 OG PNG (1200×630) + HTML，`/share/2022/{區}/{里}/` 分享到 FB / Threads 顯示專屬縮圖

---

## 資料來源

所有選舉資料與地理資料皆來自**公開、可查證、可重製**的來源：

- **選舉結果**：[kiang/db.cec.gov.tw](https://github.com/kiang/db.cec.gov.tw) — Finjon Kiang 維護的中選會原始資料映射庫（elbase / elctks / elcand / elpaty CSV）；原始出自[中央選舉委員會選舉及公民投票資料庫](https://db.cec.gov.tw/)
- **行政區界**：[g0v/twgeojson](https://github.com/g0v/twgeojson) — g0v 整理的 twTown1982 + twVillage1982 topojson；底圖出自內政部公開資料
- **里界年份**：採 1982 版界線，與 2022 資料對齊率約 98%（少數里因行政調整無法對應，面板會標示）

**準確性免責**：本專案盡力確保資料清洗正確，但僅供視覺探索與研究參考；**正式選舉資訊請以中選會公告為準**。

---

## 技術棧

| 層次 | 工具 |
|---|---|
| 3D 渲染 | Three.js + `InstancedMesh`（全台 ~43,000 方塊一次繪製） |
| 建置工具 | Vite（dev server + JSON static import） |
| 前端 | 原生 HTML / CSS（無框架） |
| 分享卡生成 | satori + @resvg/resvg-js（server-side SVG → PNG） |
| 地圖解析 | topojson-client（twTown / twVillage topo → GeoJSON） |
| 資料清洗 | Node.js ESM scripts（CEC CSV → processed JSON） |

---

## 檔案結構

```
CHANGE/
├── index.html              # 首頁 Metro 卡片 + SPA 入口
├── src/
│   ├── main.js             # Three.js 場景、互動、導航狀態機
│   ├── geo.js              # lon/lat 投影 + polygon voxelization
│   ├── palette.js          # 政黨配色、margin 飽和度 lerp、candidateColor
│   └── city-configs.js     # 六都設定（年份、相機、worldSize、geo 對照）
├── scripts/
│   ├── extract-elections.mjs      # 區級市長選舉結果（支援 --city all|tpe|tyc|…）
│   ├── extract-villages.mjs       # 里界 GeoJSON + 里級投票結果（--city flag）
│   ├── extract-ntpc.mjs           # 新北 / 台北區界（twTown topojson → GeoJSON）
│   ├── extract-tpe-elections.mjs  # 台北市 1994–2022 選舉（特殊格式）
│   ├── extract-khh-2020-byeelection.mjs  # 高雄 2020 補選
│   ├── extract-tw-outline.mjs     # 全台縣界輪廓（LineString GeoJSON）
│   └── build-share.mjs            # 預建 2022 里分享頁 + OG PNG（~5 分鐘）
├── data/
│   ├── raw/                # CEC 原始 CSV + twTown / twVillage / twCounty topojson
│   └── processed/          # 清洗後 JSON / GeoJSON（Vite static import）
│       ├── {city}-districts.geo.json       # 區界（ntpc / tpe / tyc / txg / tnn / khh）
│       ├── {city}-villages.geo.json        # 里界（同上六都）
│       ├── {city}-{year}-mayor.json        # 區級市長結果
│       └── {city}-{year}-villages.json     # 里級投票結果
└── public/
    └── taiwan.png          # 首頁背景島形圖
```

---

## 開發

```bash
npm install
npm run dev      # 啟動 http://localhost:5173
```

### 生產建置

```bash
npm run build          # vite build → dist/，再自動執行 build-share（約 5–6 分鐘）
npm run build:share    # 只重建 1,032 里的分享頁 + OG PNG
npm run preview        # 預覽 dist/
```

GitHub Pages 透過 `.github/workflows/deploy.yml` 在 push 到 `main` 時自動部署 `dist/`。

---

## 資料管線

### 新增 / 更新選舉資料

```bash
# 區級市長選舉（全六都）
node scripts/extract-elections.mjs --city all

# 只跑單一城市
node scripts/extract-elections.mjs --city tpe

# 里級投票（里界 GeoJSON + 各年里票）
node scripts/extract-villages.mjs --city all
```

輸出至 `data/processed/`，然後需重新 `npm run build`。

### 新增城市

1. 在 `data/raw/` 放入對應 CEC CSV
2. 在 `src/city-configs.js` 新增城市設定（年份、相機、geoCountyNames）
3. 跑 extract-elections + extract-villages
4. 在 `src/main.js` 補 import 與 `ALL_ELECTIONS` / `ALL_VILLAGE_ELECTIONS` / `ALL_DISTRICT_GEO` / `ALL_VILLAGE_GEO` / `ALL_FALLBACK_VILLAGES`
5. 在 `index.html` 把對應卡片改為 `<a href="?city={key}">`

---

## 里程碑

- ✅ M1–M2 Vite + Three.js 骨架、區級 voxel 渲染（新北 29 區）
- ✅ M3 hover 氣泡 + 羅盤 + 全台灰格海岸線
- ✅ M4 2022 新北選舉配色
- ✅ M5 歷史時間軸（1997–2022）
- ✅ M6 里級下鑽 + 三層卡片導航 + breadcrumb 狀態機
- ✅ M7 選中發光 + 里級歷屆資料 + URL 分享
- ✅ M8 手機 RWA 互動修復
- ✅ M9 六都擴張（台北 / 新北 / 桃園 / 台中 / 台南 / 高雄 全部上線）
- ✅ 17 年里身分條（永藍 / 永綠 / 翻轉 / 搖擺）+ hover 切年
- ✅ 1,032 里社群分享卡（預建 OG PNG + HTML）
- ✅ 候選人過濾（得票率 < 1% 不顯示）+ bubble 自動偏移
- ✅ M11 Share Tower：被分享的里長出暖白塔（log 高度，里級 ≥ 10、區級 ≥ 50），Cloudflare Worker + KV 寫入計數

下一步候選：

- M11 T5 打磨：塔生長動畫、OG 預覽驗證、1000+ 塔效能測試
- 開票日即時連中選會 JSON endpoint（M10）
- 並排比較模式（例如永和 vs 中和）
- Stage 4：首頁 voxel 全台底圖 + 卡片浮層（C 方案）

---

## 備註

- 2009 無台北縣長選舉（因即將升格，周錫瑋延任至 2010-12-24）
- 里界採 1982 版，與 2022 資料對齊率約 98%（有數里因行政調整無法對應，面板標示）
- CEC 1997 / 2001 里級資料未公開；這兩年切到里模式會顯示「無里級資料」提示
- 高雄縣 2010 前的「三民鄉」已更名為那瑪夏區，資料對應以合併後邊界為準

---

## 授權

本專案程式碼以 [MIT License](LICENSE) 釋出 — 歡迎自由使用、修改、散佈，包含商業用途，只需保留原始授權聲明。

引用的第三方資料各自遵循原始授權：CEC 資料屬政府公開資料；g0v 圖資依 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) / 內政部開放授權。使用時請一併註明來源。

## 行為準則

歡迎任何身分、任何政治光譜的貢獻者。討論請聚焦於程式、資料、視覺，不攻擊人身、不散布未經查證的指控。涉嫌違反台灣現行法律（如選舉不實言論、誹謗、隱私侵害）的內容一律移除並視情況通報。
