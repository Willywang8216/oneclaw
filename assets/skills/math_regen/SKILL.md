---
name: math_regen
description: 批次把數學題 PNG 截圖做 OCR（Markdown + LaTeX/MathJax），再依知識點重新出題（題目版 / 題目+解答版）。
user-invocable: true
metadata: {"openclaw":{"emoji":"📚"}}
---

# math_regen（Windows）：PNG 題庫 → OCR → 重新出題

## 你要先問使用者
- 你的截圖資料夾（sourceDir）：例如 `D:\Screenshots\math`
- 是否要先「複製並改名」到 OpenClaw workspace（建議：是）

OpenClaw workspace 預設在：`%USERPROFILE%\\.openclaw\\workspace`

本 skill 會固定使用以下目錄：
- input：`%USERPROFILE%\\.openclaw\\workspace\\math-bank\\input`
- output：`%USERPROFILE%\\.openclaw\\workspace\\math-bank\\output`
- artifacts：`%USERPROFILE%\\.openclaw\\workspace\\math-bank\\artifacts`

最後輸出 2 份：
1) `output\\questions.md`（只有新題）
2) `output\\questions_with_solutions.md`（新題 + 參考解答）

並另外輸出追溯用檔案：
- `artifacts\\ocr.md`
- `artifacts\\index.json`
- `artifacts\\rename-map.csv`（如果有做改名）

---

## 執行總規則（非常重要）

### A. OCR 階段只做「忠實轉寫」
- 不要解原題、不要補題、不要改題。
- 輸出格式：Markdown + LaTeX
  - 行內公式用 `$...$`
  - 獨立一行公式用 `$$...$$`
- 每張圖都要保留來源檔名。

### B. 跨頁合併（題目在一張、算式在下一張）
- 先把圖檔整理成連號：`0001.png, 0002.png, ...`（這樣最穩）
- 判斷「新題 vs 延續」：
  - 如果 OCR 內容明確出現題號/例題（如「第…題」「例題」）或出現完整題幹敘述 → 視為新題
  - 如果幾乎都是等式推導/計算步驟/圖上標記，而且沒有題號與敘述 → 視為上一題延續

### C. 重新出題（避免死背）
對每一題（合併後的 OCR 題目）：
- 抽取 3~8 個知識點
- 重新設計 1 題新題（同知識點，但改敘述/情境/數值；問法可變形）
- 題目+解答版要附上「可教學」的參考解答

---

## 建議流程（你應該照做）

### 1) 建立目錄（如果不存在）
用 `exec` 在 Windows（PowerShell）建立：

- `input/output/artifacts`：
  - `New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.openclaw\\workspace\\math-bank\\input" | Out-Null`
  - `New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.openclaw\\workspace\\math-bank\\output" | Out-Null`
  - `New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.openclaw\\workspace\\math-bank\\artifacts" | Out-Null`

### 2) （推薦）複製並改名成 0001.png…
如果 sourceDir 內是像「螢幕擷取畫面 2026-01-19 153925.png」這種檔名，請用 `exec` 跑下面 PowerShell，將檔案複製到 input 並依時間排序改名：

```powershell
$src = "D:\\Screenshots\\math"
$dst = "$env:USERPROFILE\\.openclaw\\workspace\\math-bank\\input"
$art = "$env:USERPROFILE\\.openclaw\\workspace\\math-bank\\artifacts"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
New-Item -ItemType Directory -Force -Path $art | Out-Null

$items = Get-ChildItem -Path $src -Filter *.png | ForEach-Object {
  $m = [regex]::Match($_.BaseName, '(\d{4})-(\d{2})-(\d{2})\s+(\d{6})')
  $dt = if ($m.Success) {
    $t = $m.Groups[4].Value
    Get-Date ("{0}-{1}-{2} {3}:{4}:{5}" -f $m.Groups[1].Value,$m.Groups[2].Value,$m.Groups[3].Value,$t.Substring(0,2),$t.Substring(2,2),$t.Substring(4,2))
  } else {
    $_.LastWriteTime
  }
  [pscustomobject]@{ File = $_; SortKey = $dt }
} | Sort-Object SortKey, @{Expression={$_.File.Name}; Ascending=$true}

$map = @()
$i = 1
foreach ($it in $items) {
  $newName = "{0:D4}.png" -f $i
  Copy-Item -LiteralPath $it.File.FullName -Destination (Join-Path $dst $newName)
  $map += [pscustomobject]@{
    seq = $i
    newName = $newName
    oldName = $it.File.Name
    oldPath = $it.File.FullName
    sortKey = $it.SortKey.ToString("s")
  }
  $i++
}

$map | Export-Csv -NoTypeInformation -Encoding UTF8 (Join-Path $art "rename-map.csv")
"Done"
```

### 3) 取得 input 內 png 清單（按檔名排序）
用 `exec`：

```powershell
Get-ChildItem -Path "$env:USERPROFILE\\.openclaw\\workspace\\math-bank\\input" -Filter *.png | Sort-Object Name | Select-Object -ExpandProperty FullName
```

### 4) 對每張圖做 OCR（用 image 工具）
每張圖都呼叫 `image`，prompt 固定為：

- 你只做「忠實轉寫」，不要解題。
- 輸出 Markdown + LaTeX（`$...$` / `$$...$$`）。
- 若看起來是上一題延續（幾乎只有算式/推導），在第一行輸出：`> continuation: true`
- 若有題號/例題，請用 `###` 標題寫出。

### 5) 合併跨頁 → 得到題目陣列
把 OCR 結果依順序合併為：
- `[{ id: 1, sources: ["0001.png","0002.png"], ocrMarkdown: "..." }, ...]`

### 6) 對每題：知識點 + 新題 + 解答
- 知識點：3~8 點
- 新題：同知識點但改敘述/數值/問法
- 解答：只寫入題目+解答版

### 7) 輸出檔案（write 工具）
- `output\\questions.md`
- `output\\questions_with_solutions.md`
- `artifacts\\ocr.md`
- `artifacts\\index.json`

---

## 失敗時的處理
- 如果 `image` 工具報錯或說不支援圖片：請要求使用者切換到支援圖片的模型，或在 OpenClaw 設定中配置 image model（再重試）。
