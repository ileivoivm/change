# CHANGE — 分享塔(Share Tower)分工與待辦

> **使用規則**:開始做某個 task 前,先在「進行中」區標記(附 session 名稱或日期),避免撞車。完成後把 checkbox 打勾,並移到「完成紀錄」。每個 session 開始前先讀這份文件。
>
> **本功能目標**:讓被分享的里在地圖上長出「塔」(細線 + 頂端圓球),分享越多塔越高,達到門檻才會出現。讓路過民眾看到遠處高塔會好奇「那是哪一個里」,進而探索。

---

## Session 名稱對照

| 代號 | 說明 |
| --- | --- |
| **小A** | 驗證用 session — 負責測試、截圖回報、確認功能正確 |
| **小B** | 執行用 session — 負責所有實作與推送 |
| **小C** | 後端 session — 負責 Cloudflare Worker / KV 設定與部署 |

---

## 進行中的工作

| Session | 日期 | 工作內容 |
| --- | --- | --- |
| — | — | (無，待認領) |

---

## 設計決策(已定)

| 項目 | 決定 |
| --- | --- |
| 後端 | Cloudflare Workers + KV |
| Worker URL | 待部署後填入 |
| 後端本地驗證 | `npm run test:worker` 與 `wrangler deploy --dry-run` 已通過（2026-04-26，小C） |
| 計數事件 | `share`(按分享鈕)、`view`(從 ?ref=share 進來) |
| 出現門檻 | 里級 ≥ 10、區級 ≥ 50 |
| 高度演算法 | `log(count - threshold + 1) * scale`(對數縮放) |
| 塔結構 | 細線(柱身)+ 頂端圓球 + 自發光材質 |
| 塔顏色 | 中性暖白光,不帶政治色 |
| 雙層塔 | 鏡頭遠看區級塔,鏡頭近看里級塔,淡入淡出切換 |
| 防刷 | sessionStorage 30 分鐘內同里只計一次 + Worker 端 IP 鎖 10 分鐘 |
| 動畫 | 第一版靜態,後期再加生長動畫 |

> 任何決策若實作中發現不合適,先在 PR 描述標註並回頭修這份表格。

---

## 驗證清單(小A 負責逐項確認)

| 項目 | 預期 | 驗證狀態 |
| --- | --- | --- |
| Stage T0 後端 | Worker 部署成功,curl POST/GET 都通 | ⏳ 等部署 · 🔍 小A 預驗證 2026-04-26：smoke test pass、code 正確、邏輯完整 |
| Stage T0 KV | KV namespace 綁定,寫入後可讀回 | ⏳ 等部署 · 🔍 wrangler.toml 待小C 填 KV ID（目前是 placeholder）|
| Stage T0 CORS | 從 ileivoivm.github.io 可呼叫 Worker,無 CORS 錯誤 | ⏳ 等部署 · 🔍 小A 預驗證：白名單、preflight、Vary 都正確 |
| Stage T1 share 按鈕 | 每個里頁面出現分享按鈕,手機 navigator.share 正常 | ⏳ 待驗證 |
| Stage T1 計數寫入 | 按下分享後 KV 對應 key 數字 +1 | ⏳ 待驗證 |
| Stage T1 view 計數 | 從 ?ref=share 進入該里時 view +1 | ⏳ 待驗證 |
| Stage T1 防刷 | 同瀏覽器 30 分鐘內按多次只計一次 | ⏳ 待驗證 |
| Stage T2 載入計數 | 切換城市時 fetch counts,console 看到資料 | ⏳ 待驗證 |
| Stage T2 區級加總 | 區級數字 = 該區所有里的 share+view 加總 | ⏳ 待驗證 |
| Stage T3 里級塔 | 達 10 次的里長出塔,未達不顯示 | ⏳ 待驗證 |
| Stage T3 區級塔 | 達 50 次的區長出塔(遠視角看得到) | ⏳ 待驗證 |
| Stage T3 高度對數 | 100 次塔約 2 voxel 高、1000 次約 4 voxel 高 | ⏳ 待驗證 |
| Stage T3 雙層切換 | 鏡頭距離切換時里塔/區塔淡入淡出 | ⏳ 待驗證 |
| Stage T4 互動 | hover 顯示 tooltip(里名 + 分享次數) | ⏳ 待驗證 |
| Stage T4 點塔 | 點塔飛到該里並開啟詳細 | ⏳ 待驗證 |
| Stage T5 動畫 | 塔生長動畫 ease-out 0.8 秒 | ⏳ 待驗證 |
| Stage T5 OG | 分享連結在 FB/Threads/Line 預覽圖正確 | ⏳ 待驗證 |
| Stage T5 效能 | 1032 里全部有塔時 FPS ≥ 30 | ⏳ 待驗證 |

---

## 待辦事項(可認領)

### Stage T0:後端基礎建設(小C)

* [ ] 建立 Cloudflare 帳號 + 開啟 Workers
* [ ] 建立 KV namespace `change-tally`
* [x] 撰寫 Worker:
  * [x] `POST /tally`:body `{ city, district, village, event }`,寫入 KV
  * [x] `GET /counts?city=ntpc`:回傳該城市所有里的 counts
  * [x] CORS headers 允許 `https://ileivoivm.github.io`
  * [x] 防刷:Worker 端用 IP + key TTL 10 分鐘鎖
* [ ] 部署 Worker(`wrangler deploy`),記下 endpoint URL
* [x] 寫一份 `worker/README.md` 給其他 session 看

**KV key 設計**(請與小B 對齊):

```
key:    {city}-{districtId}-{villageId}        例:ntpc-板橋區-留侯里
value:  {"shares": 23, "views": 41, "lastUpdate": 1714...}
```

### Stage T1:前端分享流程(小B) ✅ 2026-04-26

* [x] 在每個里的詳細頁(bubble)加分享按鈕（替換舊「複製分享連結」）
* [x] 桌機:複製 app URL + ref=share 到剪貼簿
* [x] 手機:`navigator.share()` 原生分享（fallback 剪貼簿）
* [x] 分享連結自動帶 `?city=xxx&y=YYYY&d=XXX&v=XXX&ref=share`
* [x] 點擊分享按鈕同時 `POST /tally` 寫入 share 事件（Worker 未部署時靜默 no-op）
* [x] 頁面載入時若 URL 有 `?ref=share` → `POST /tally` 寫入 view 事件
* [x] 防刷:sessionStorage 記錄 30 分鐘內已計過的 key

### Stage T2:讀取與聚合(小B) ✅ 2026-04-26

* [x] 城市載入時 `GET /counts?city=xxx`,存進 `window.shareCounts`（Worker 未部署時靜默跳過）
* [x] `fetchShareCounts()` 內含區級加總 → `districtShareCounts` Map
* [x] `getTotalForVillage(townName, villageName)` 取 share + view 總和
* [x] 控制台 `console.table(window.shareCounts)` 可看到資料
* [ ] (可選)每 60 秒輪詢一次更新

### Stage T3:塔的視覺渲染(小B) ✅ 2026-04-26

* [x] `buildTowerIM()` 用 InstancedMesh 建里/區塔（shaft cylinder + top sphere）
* [x] 細圓柱體當柱身(`CylinderGeometry` radius 0.05)
* [x] 球體當頂端(`SphereGeometry` radius 0.15)
* [x] `MeshStandardMaterial` emissive 暖白色 #fff5d6
* [x] 高度演算法 `log(count - threshold + 1) * 0.8`
* [x] 里級塔:count ≥ 10 才建塔
* [x] 區級塔:count ≥ 50 才建塔
* [x] InstancedMesh 效能優化（兩組：villageTower + districtTower）
* [x] LOD：dist < 60 看里塔，dist > 40 看區塔，中間兩者並存

### Stage T4:互動(小B) ✅ 2026-04-26

* [x] hover 塔 → tooltip 顯示「○○里 · 已被分享 N 次」
* [x] 點塔 → 相機飛到該里並開啟詳細（沿用現有下鑽機制）
* [x] mobile touch 透過現有 pointerdown/up 機制自動支援

### Stage T5:打磨

* [ ] 塔生長動畫(球先出現,線把球頂上去,0.8 秒 ease-out)
* [ ] 確認 OG 圖在 FB / Threads / Line 預覽正常
* [ ] 效能測試:1000+ 塔同時存在 FPS 監控
* [ ] 文案:首頁加一行「這張地圖會隨民眾分享而生長,塔的高度是被點亮的次數」
* [ ] (可選)時間衰減:舊分享慢慢沉下去,新的長起來

### Stage T6:延伸(暫不做)

* [ ] 排行榜頁面:列出 Top 20 被分享的里
* [ ] 時光機:看半年前/一年前的塔分布
* [ ] 即時推播:有人正在分享某里時塔閃一下

---

## Session 接手提示

每個 session 開新對話時請貼:

1. 這份 `SHARE_TOWER_TODO.md` 內容
2. Repo 連結 https://github.com/ileivoivm/change
3. 本 session 要做的 Stage(例:「我是小B,要做 Stage T3」)
4. 已部署的 Worker URL(若已完成 T0)

**特別給後端 session(小C)**:工作完成後務必把 Worker URL 寫進這份文件的「設計決策」表,讓小B 能取用。

**特別給渲染 session(小B 做 T3)**:
* 現有 voxel 用的是 three.js
* 里中心點請用 geojson centroid 計算(若現有資料沒有,需先寫 helper)
* 區級命名規則跟現有 KV key 對齊(`ntpc-板橋區` 之類)

---

## 美學原則(所有 session 共讀)

* 塔的視覺是**邀請探索**,不是炫耀數字。遠看到「那邊有一根高塔」,會想走過去看,才是這個設計成功的時候。
* 沒被分享的里**完全不畫塔**,讓沉默是沉默,被點亮才發聲。
* 塔顏色刻意中性,不要被解讀成「藍綠對抗」的延伸。這層是民眾關注,不是選舉結果。
* 文案保持平實,不要寫成科技感行銷詞。

---

## 完成紀錄

| 日期 | Session | 內容 |
| --- | --- | --- |
| 2026-04-26 | 小C | Stage T0 Worker 程式、Wrangler 設定、README、local smoke test 完成；正式 KV / deploy 待 Cloudflare 登入 |
| 2026-04-26 | 小A | Stage T0 預驗證（部署前）：worker code review 通過、`node worker/test/smoke.mjs` pass、README↔code 一致；發現 2 項小提醒不阻擋 deploy（見下） |
| 2026-04-26 | 小B | Stage T1–T4 前端全部完成：分享按鈕（navigator.share + 剪貼簿）、tally POST/view 追蹤、sessionStorage 防刷、fetchShareCounts + districtShareCounts、InstancedMesh 塔渲染（里/區雙層 LOD）、hover tooltip + 點塔下鑽 |

### 小A 預驗證備註（2026-04-26）

- ✅ smoke test 通過：share/lock/view/invalid event 行為皆符合預期
- ✅ POST /tally：JSON parse、normalizePart 校驗（regex + length ≤ 64）、IP SHA-256 lock 10min TTL
- ✅ GET /counts：cursor 分頁、`{city}-` prefix 過濾正確
- ✅ CORS：OPTIONS 204 + 白名單 `ileivoivm.github.io` + `Vary: Origin`
- ✅ README 描述與 code 完全一致
- ⚠️ `parseKey` 用 `split("-")` 解析 — 若 district/village 名稱含 `-` 會錯解；台灣實際地名無 `-`，當前 OK，但 regex 允許 `-` 與 key 分隔策略理論不一致
- ⚠️ `read → put` 非原子；同 IP 已被 lock 擋住，不同 IP 同時擊中可能少 1 票（量級無感）

部署完成後小A 還需補做：curl POST/GET 真實 endpoint、CORS preflight 實測、KV 寫入後 list 可讀回。
