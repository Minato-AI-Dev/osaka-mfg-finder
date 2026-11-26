# CSV フォーマット仕様

- 文字コード: **UTF-8**（BOM あり・なし どちらも可）。エクスポートは Excel で開けるよう BOM 付き UTF-8 です。
- 1行目は列名（ヘッダー）。列の**順序は自由**ですが、下表の列名は**すべて必要**です（不足があると取り込み不可）。
- 値に `,` `"` 改行を含む場合は `"` で囲み、内部の `"` は `""` と書きます。
- 日付は `YYYY-MM-DD`。
- `source_url` は `http(s)://…` の URL、または架空データ用の `fictional://…` を指定します。
- `license_status` は下表の 4 値のみ。**外部AI（OpenAI）へ送信されるのは `licensed` と `fictional` のみ**です。
- 同じ ID が同一ファイル内に 2 回ある場合はエラーになります。既存 ID と同じ場合は**上書き**（更新）されます。
- テンプレート: 画面の「テンプレートCSVをダウンロード」または `GET /api/templates/suppliers`（`demands`）。

## 1. 企業（`suppliers`）

| 列名 | 必須 | 説明 | 例 |
|---|---|---|---|
| `supplier_id` | ✅ | 企業ID（一意） | `S-01` |
| `name` | | 企業名 | `【架空】東大阪精密切削工業` |
| `location` | ✅ | 所在地 | `大阪府東大阪市` |
| `industry` | | 業種 | `機械部品加工` |
| `processes` | ✅ | 保有加工技術 | `精密切削加工（NC旋盤・マシニングセンタ）、微細穴加工` |
| `materials` | | 対応材料 | `アルミ（A5052・A6061）、SUS304、真鍮` |
| `equipment` | | 主要設備 | `NC旋盤、マシニングセンタ、三次元測定機` |
| `precision` | | 加工精度 | `±0.01mm（指定時）` |
| `dimensions` | | 対応寸法 | `φ2〜200mm` |
| `capacity` | | ロット・生産能力 | `1〜500個（小ロット試作対応）` |
| `products` | | 製品・加工実績 | `医療機器部品の試作・小ロット` |
| `strengths` | | 技術的な強み | `試作の短納期対応、微細穴加工` |
| `source_url` | ✅ | 情報取得元URL | `https://…` / `fictional://sample/S-01` |
| `license_status` | ✅ | 利用許諾状態 | `fictional` |

> 空欄の項目は画面で「未記載」と表示され、AIには「不明」として渡されます（推測で補完はしません）。

## 2. 需要（`demands`）

| 列名 | 必須 | 説明 | 例 |
|---|---|---|---|
| `demand_id` | ✅ | ニーズID（一意） | `D-01` |
| `title` | ✅ | タイトル | `医療機器向けステンレス精密部品の小ロット試作` |
| `issuer` | ✅ | 発信元組織 | `（架空）医療機器開発企業A` |
| `industry` | | 業界 | `医療機器` |
| `problem` | ✅ | 解決したい課題 | `手術器具の試作部品を小ロットで短納期に作りたい` |
| `required_functions` | | 求める機能 | `精密な試作部品の供給` |
| `required_technologies` | | 必要とされる技術 | `精密切削加工、微細穴加工` |
| `materials` | | 材料条件 | `SUS304` |
| `required_conditions` | | 必須条件（寸法・精度など） | `φ5〜20mm、公差±0.01mm` |
| `desired_conditions` | | 希望条件 | `表面粗さの指定あり` |
| `quantity_delivery` | | 数量・納期 | `10〜30個` |
| `region` | | 地域制限 | `大阪府内（希望）` |
| `published_at` | | 公開日（`YYYY-MM-DD`） | `2026-09-01` |
| `deadline` | | 募集期限（`YYYY-MM-DD`） | `2027-03-31` |
| `source_url` | ✅ | 情報取得元URL | `fictional://sample/D-01` |
| `license_status` | ✅ | 利用許諾状態 | `fictional` |
| `demand_type` | ✅ | ニーズの種類（下表） | `order` |

### `demand_type`（ニーズの種類）

| 値 | 意味 | 扱い |
|---|---|---|
| `order` | 実際の発注・調達案件 | 確定した需要として扱う |
| `tech_search` | 企業が公開した技術探索ニーズ | 発注は確定していない |
| `rnd_theme` | 研究開発テーマ | **確定発注として扱わない**（画面に明示） |
| `hypothesis` | 将来の用途仮説 | **確定発注として扱わない**（画面に明示） |

## 3. 利用許諾状態（`license_status`）

| 値 | 意味 | 外部AIへの送信 |
|---|---|---|
| `licensed` | 利用許諾を確認済み | ✅ 可 |
| `fictional` | 架空データ（検証用） | ✅ 可 |
| `unverified` | 許諾未確認 | ❌ 不可（キーワード検索・閲覧のみ） |
| `restricted` | 利用不可 | ❌ 不可 |

## 4. 正解データ（任意・Precision@K 用）

`sample-data/ground_truth_sample.csv` の形式。ファイルを読み込むのは `prisma/seed.ts`（`npm run db:seed`）です。

| 列名 | 説明 |
|---|---|
| `demand_id` | 需要ID |
| `supplier_id` | 企業ID |
| `relevant` | `1`（適合・正解）/ `0`（不適合） |
| `note` | 判定理由（任意） |

正解データが存在する需要についてのみ Precision@K を表示します。
