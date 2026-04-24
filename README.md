# CHANGE — 台灣選戰版圖

以 Three.js 打造的 Minecraft 風格互動地圖，呈現台灣市長 / 縣長選舉 1997→2022 的歷屆版圖變化。

目前聚焦新北市（前身台北縣），29 個行政區、1,032 個里；外圍以灰色方塊展示全台其他縣市作為地理 context，黑色海岸線勾勒島嶼輪廓。

## 功能

- **三層導航**：全景 → 點區 drill 到區 → 點里放大 + 彈出票數
- **時間軸**：1997 / 2001 / 2005 / 2010 / 2014 / 2018 / 2022 七場市長選舉（台北縣長 14~16 屆 + 新北市長 1~4 屆）
- **里級歷史資料**：2005 起有里級細部（1997 / 2001 CEC 未公開里級）
- **即時色彩過渡**：切換年份，每個方塊顏色平滑 tween 到當年結果
- **選區配色邏輯**：色相永遠是勝方政黨色（絕不用敗方色）；margin ≥ 20% 為純勝方色，margin=0 時為淡化的勝方色，中間線性內插飽和度
- **左側清單**：29 區可展開，每里一行色塊 + 得票差 %
- **空白鍵隱藏卡片**：全景視角按 Space（或點「新北市」/ 空地）把卡片收起，露出完整 voxel 地圖自由探索
- **選中發光**：點里自動高亮，金色呼吸 glow + pinned bubble
- **相機控制**：右上角羅盤（一鍵正北俯瞰）、Zoom +/-、Home（回初始視角）
- **相機讀數**：左下角即時顯示 pos / target / dist / azimuth / pitch，方便調整起始視角
- **URL 分享**：`?y=2022&d=永和&v=安和` 直接定位任一年/區/里
- **社群分享卡**：2022 每里都有預建 OG 圖 + HTML，`/share/2022/{區}/{里}/` 分享到 FB / Threads 會顯示翻盤所需票數的專屬縮圖

## 退出 drill 四種方式

1. 點地圖空地
2. ESC
3. Home 按鈕
4. 點左側「新北市」header

## Drill 狀態下的互動範圍

點進某區（例如永和）後，滑鼠 / 點擊只會對該區的里作用；其他新北市區、台北市、全台灰底、海邊都不會觸發 bubble。沒有 1982 里界但有 2022 票數的里（如 蘆洲福安里、永和新里）從面板點進去仍會顯示票數 bubble，錨定在該區中心。

## 資料來源

- **選舉**：[kiang/db.cec.gov.tw](https://github.com/kiang/db.cec.gov.tw)（中選會原始 elbase / elctks / elcand / elpaty CSV）
- **行政區界**：[g0v/twgeojson](https://github.com/g0v/twgeojson) 的 twTown1982 + twVillage1982 topojson

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
npm run build:share      # 只重建 share 頁（1,032 村里，約 5 分鐘）
```

GitHub Pages 透過 `.github/workflows/deploy.yml` 在 push 到 main 時自動部署 `dist/`。

## 里程碑

- ✅ M1–M2 Vite + Three.js 骨架、新北區級 voxel
- ✅ M3 hover 浮動標籤 + 羅盤
- ✅ M4 2022 新北市長選舉配色
- ✅ 全台灰格 + 黑色海岸線
- ✅ M5 歷史時間軸（1997–2022）
- ✅ M6 里級下鑽 + 左側清單
- ✅ 點區飛入 + 三層面板導航
- ✅ 選中發光 + 里級歷屆資料 + URL 分享

下一步候選：

- 開票日即時連中選會 JSON endpoint
- 擴張到其他縣市（台北、桃園、台中、台南、高雄…）
- 並排比較模式（永和 vs 中和）

## 備註

- 2009 無台北縣長選舉資料（因即將升格新北市，周錫瑋延任至 2010-12-24）
- 里界採 1982 版，與 2022 資料對齊率約 98%（有 16 里因行政調整無法對應）
- CEC 1997 / 2001 的里級資料未公開，這兩年選到里模式會顯示灰色 + 提示
