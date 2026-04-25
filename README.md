# CHANGE — 台灣選戰版圖

🌐 **線上版**：<https://ileivoivm.github.io/change/>

以 Three.js 打造的 Minecraft voxel 風格互動地圖，呈現台灣六都市長 / 縣長選舉 1994→2022 的歷屆版圖變化。

現已支援六都（台北 / 新北 / 桃園 / 台中）逐城市切換；首頁以 Metro 卡片呈現各城市入口，背景以 voxel 台灣島底圖烘托氣氛。外圍以灰色方塊展示全台其他縣市作為地理 context，黑色海岸線勾勒島嶼輪廓。

## 歡迎參與

這是一個**公益性、開放原始碼**的選舉資料視覺化專案，以 MIT 授權釋出。製作初衷是讓公民用更直覺的方式認識自己選區的歷史脈絡，不帶任何政治立場、不為任何候選人或政黨背書。

- 🐛 發現 bug、資料誤植、或區里名稱對不上 → 歡迎開 [Issue](https://github.com/ileivoivm/change/issues)
- ✨ 想改善配色、加功能、擴張到其他縣市 → 歡迎送 [Pull Request](https://github.com/ileivoivm/change/pulls)
- 💡 有新的視覺點子或資料來源建議 → 也歡迎 Issue 討論

本專案尊重並遵守中華民國（台灣）法律，包含但不限於《選舉罷免法》、《個人資料保護法》、《著作權法》。所有選舉資料皆取自中選會公開資料，不蒐集、不推斷任何個人投票行為。

## 功能

- **三層導航**：全景 → 點區 drill 到區 → 點里放大 + 釘住票數氣泡，頂部以 `[新北市][永和區][安和里]` breadcrumb 呈現當前位置
- **時間軸**：1997 / 2001 / 2005 / 2010 / 2014 / 2018 / 2022 七場市長選舉（台北縣長 14~16 屆 + 新北市長 1~4 屆）
- **里級歷史資料**：2005 起有里級細部（1997 / 2001 CEC 未公開里級）
- **17 年里身分條**：氣泡底部 5 格色塊顯示 2005–2022 同一里的政黨脈絡，加上「永藍里 / 永綠里 / 翻轉里 / 搖擺里」身分標籤
- **hover 滑動切年**：游標劃過身分條的色塊即時跳到該年，氣泡作用為該里的 mini 時間軸
- **即時色彩過渡**：切換年份，每個方塊顏色平滑 tween 到當年結果
- **選區配色邏輯**：色相永遠是勝方政黨色（絕不用敗方色）；margin ≥ 20% 為純勝方色，margin=0 時為淡化的勝方色，中間線性內插飽和度
- **卡片 Metro 佈局**：頂部新北市卡 + 下方 29 區 5 欄格（桌機）或 3 欄自適應（手機）；drill 後收斂成 breadcrumb 條 + 下方里格
- **空白鍵隱藏卡片**：全景視角按 Space（或點「新北市」/ 空地）把卡片收起，露出完整 voxel 地圖自由探索；drilled 狀態再按一次會把里格也收起便於旋轉視角
- **手機 RWA**：行動裝置預設收合卡片讓使用者先看到地圖，點進里後自動收起里格保留 OrbitControls 手勢空間
- **選中發光**：點里自動高亮，金色呼吸 glow + pinned bubble
- **相機控制**：右上角羅盤（一鍵正北俯瞰）、Zoom +/-、Home（回初始視角）
- **相機讀數**（桌機）：左下角即時顯示 pos / target / dist / azimuth / pitch，方便調整起始視角
- **URL 分享**：`?y=2022&d=永和&v=安和` 直接定位任一年/區/里
- **社群分享卡**：2022 每里都有預建 OG 圖 + HTML，`/share/2022/{區}/{里}/` 分享到 FB / Threads 會顯示翻盤所需票數的專屬縮圖；氣泡內「複製分享連結」按鈕在 2022 以外年份以灰色呈現（不可點），確保氣泡高度在年份切換時不變

## 退出 drill 四種方式

1. 點地圖空地
2. ESC
3. Home 按鈕
4. 點上方「新北市」breadcrumb chip

## Drill 狀態下的互動範圍

點進某區（例如永和）後，滑鼠 / 點擊只會對該區的里作用；其他新北市區、台北市、全台灰底、海邊都不會觸發 bubble。沒有 1982 里界但有 2022 票數的里（如 蘆洲福安里、永和新里）從卡片點進去仍會顯示票數 bubble，錨定在該區中心。

## 資料來源

本專案所有選舉資料與地理資料皆來自**公開、可查證、可重製**的來源，特此註明並致謝：

- **選舉結果**：[kiang/db.cec.gov.tw](https://github.com/kiang/db.cec.gov.tw) — 由 [Finjon Kiang](https://github.com/kiang) 維護的中選會原始資料映射庫（elbase / elctks / elcand / elpaty CSV）。原始資料出自 [中央選舉委員會選舉及公民投票資料庫](https://db.cec.gov.tw/)。
- **行政區界**：[g0v/twgeojson](https://github.com/g0v/twgeojson) — g0v 零時政府社群整理的 twTown1982 + twVillage1982 topojson，底圖出自內政部公開資料。
- **里界參考年份**：採 1982 版界線，與 2022 投票結果對齊率約 98%（16 里因行政調整無對應，面板會標示）。

**資料準確性免責**：本專案盡力確保資料清洗過程無誤，但最終結果僅供視覺探索與研究參考；**正式選舉資訊請以中選會公告為準**。若發現數字或區里對應有誤，歡迎開 Issue 回報。

## 技術棧

- Three.js + `InstancedMesh`（全台 ~43,000 方塊一次繪製）
- Vite（dev server + JSON import）
- 原生 HTML / CSS（無框架）
- Node scripts 做資料清洗（CEC → JSON）

## 架構

```
src/
  main.js       — scene / interaction
  geo.js        — lon/lat 投影 + polygon voxelization
  palette.js    — 政黨配色 + 梯度 lerp
scripts/
  extract-ntpc.mjs          — 抽 台北縣 / 台北市 / 其他縣市區界
  extract-elections.mjs     — 抽歷屆 區級選舉結果
  extract-villages.mjs      — 抽里界 + 歷屆里級選舉結果
  extract-tw-outline.mjs    — 抽全台縣界
  build-share.mjs           — 產生 1,032 個里的社群分享頁 + OG PNG (satori)
data/
  raw/          — CEC 原始 CSV 與 topojson（downloaded）
  processed/    — 清洗後 JSON（import 進 Vite）
```

## 開發

```bash
npm install
npm run dev
```

開 `http://localhost:5173`。

### 上線前建置

```bash
npm run build            # vite build → dist/，然後自動跑 build-share
npm run build:share      # 只重建 share 頁（1,032 里 OG PNG + HTML，約 5–6 分鐘）
```

GitHub Pages 透過 `.github/workflows/deploy.yml` 在 push 到 main 時自動部署 `dist/`。

## 里程碑

- ✅ M1–M2 Vite + Three.js 骨架、新北區級 voxel
- ✅ M3 hover 浮動標籤 + 羅盤
- ✅ M4 2022 新北市長選舉配色
- ✅ 全台灰格 + 黑色海岸線
- ✅ M5 歷史時間軸（1997–2022）
- ✅ M6 里級下鑽 + 三層卡片導航
- ✅ 點區飛入 + breadcrumb chip 狀態機
- ✅ M7 選中發光 + 里級歷屆資料 + URL 分享
- ✅ M8 手機 RWA 互動修復（卡片 vs OrbitControls 交互）
- ✅ 17 年身分條（永藍/永綠/翻轉/搖擺里）+ hover 滑動切年
- ✅ 1,032 里社群分享卡（預建 OG PNG + HTML）

下一步候選：

- 開票日即時連中選會 JSON endpoint
- 擴張到其他縣市（台北、桃園、台中、台南、高雄…）
- 並排比較模式（永和 vs 中和）

## 備註

- 2009 無台北縣長選舉資料（因即將升格新北市，周錫瑋延任至 2010-12-24）
- 里界採 1982 版，與 2022 資料對齊率約 98%（有 16 里因行政調整無法對應）
- CEC 1997 / 2001 的里級資料未公開，這兩年選到里模式會顯示灰色 + 提示

## 授權

本專案程式碼以 [MIT License](LICENSE) 釋出 — 歡迎自由使用、修改、散佈，包含商業用途，只需保留原始授權聲明。

引用的第三方資料各自遵循原始授權：CEC 資料屬政府公開資料、g0v 圖資依原始採用的 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) / 內政部開放授權。使用時請一併註明來源。

## 行為準則

歡迎任何身分、任何政治光譜的貢獻者。討論請聚焦於程式、資料、視覺，不攻擊人身、不散布未經查證的指控。涉嫌違反台灣現行法律（如選舉不實言論、誹謗、隱私侵害）的內容一律移除並視情況通報。
