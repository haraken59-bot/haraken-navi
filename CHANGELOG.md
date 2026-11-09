# 変更履歴（最新記録を先頭に記載）

## 2026-10-31 GPS共通処理5案件・本番公開完了／Android確認
- 公開版 `20261030-gps-common-navi`、公開コミット `0cd4d115550b5a5fca4d41b818963258437ac506`、正式URL https://haraken59-bot.github.io/haraken-navi/ 。
- GitHub Pages run 41127130322成功。対象9ファイルのHTTP 200・内容一致、版表示、スマホ幅画面、JavaScriptエラー0件との公開作業報告。
- 対象: `importer/gps-diagnostics.js`、`importer/photo-location.js`、`importer/photo-location-map.js`、`importer/photos.js`、`meal-ui.js`、`meal-record.js`、`meal-photo.js`、`main.js`、`index.html`。
- 分離版の単体43件・ブラウザモック10件・構文8ファイル成功。以前の102件・隔離DB15件・Android検証結果は再実行せず引き継ぎ。
- 公開版Androidで、ユーザーが新版表示、GPSなし写真選択、地図指定、キャンセル、再指定・確定と `user_map` 表示の5項目成功を報告。実保存は未実施。
- 訪問分類・参考候補・関連CIを除外。本番DB・Storage・RPC・Edge、独立写真DBの変更なし。復旧不要。
- 写真DB全機能統合は未完了。外部店舗検索のOverpassタイムアウトとナビ入力保持の問題は別案件として継続。

## 2026-10-31 管理文書の公開状態同期
- `NAVI_STATUS.md` と `CHANGELOG.md` が10月25日の記録で止まっていたため、公開済みGPS版とAndroid最終確認を追記。
- 古い記録は履歴として保持し、現行状態は `NAVI_STATUS.md` の最新節を優先。文書のみ更新し、製品コード・DB・Storage・Edgeの変更なし。

---

## 2026-10-25 写真機能の公開差分切り出し：準備完了・未公開
- 公開基準: ab777269a91dcc178b86829e04c27790feb561d7。GitHub mainとPages deployment 7237191827（success）が同SHA。原開発領域を保持し、work/camera-gps-release-20261025 / release/camera-gps-20261025へローカル隔離コピー。
- 公開予定版20261025-camera-gps。製品差分8ファイル: meal-ui.jsの写真入力/表示/本人確認のみ、style.cssの写真カード/縦ボタンのみ、importer/photos.js、importer/gps-diagnostics.js、importer/jpeg-ref-diagnostics.js、meal-photo.js読込エラー表示、index.html/main.jsの参照版のみ。
- 変更依存チェーンはindex→main→meal-ui→meal-photo→importer/photos→gps-diagnostics→jpeg-ref-diagnosticsまで新URL版。未変更のstore-link-ui/meal-client等は旧版を維持。新SWなし。認証/保存/履歴/店舗検索/推薦/他アプリ連携は基準との一致を静的assertで確認。
- 開発版の推薦/過去料理表示、OSM/Google試作、LANサーバー、架空データ、SHA比較、仮fingerprint、現在地検証、保存禁止設定は取り込みなし。JPEG生バイト/変換過程の詳細表示も製品UIから除外。正常座標、失敗状態、写真詳細、本人確認は維持。直接JPEGモジュールは空Ref判定/有理数変換依存として含める。
- 分離後: 単体36 PASS/0FAIL（直前実行を引継ぎ、再開後再実行なし）、本番ファイル無変換のlocalhostブラウザ5 PASS/0FAIL、構文6ファイルPASS、相対import解決/許可リスト/保存ハンドラー基準一致PASS。モック通信のみ・実API0・業務データ書込0。静的検査初回は既存mainのuid用Math.randomを新規仮IDと誤判定し、基準一致を確認して検査対象を修正。製品の追加修正なし。
- Androidで確認済みのcamera-buttons-local成果を継承。ただし分離版そのもののAndroid操作・公開後配信キャッシュ確認は未実施。ローカルブラウザでは実crypto SHA/縮小前EXIF/本人確認取消/過去画像表示削除/自動検索なし/通常main起動を確認。
- 公開前残作業: 本人承認、当日時点main変化の確認、既存配備方式の対象資産8件追加/更新とテスト資産除外確認。公開後HTTP200/ハッシュ一致/旧キャッシュ更新/Android最小確認。DB/Edge操作不要。失敗時はこの変更コミットをrevertし再配信、force push不要。
- 今回push/本番公開/DB/Edge変更なし。公開承認待ちで停止。

## 2026-10-22 写真500m・RPC互換性の限定公開
- バージョン20261022-photo500m。公開直前基準9d2c542b424dceb795fce63085f3a8df7e0dfe3dからrelease/photo500m-only-20261022へ対象のみ切り出し。
- 登録店舗の写真GPS500m検索、名称絞り込み/保持/万萬照合、重複確認/確認取消、スマホカード、store_idとunlinked_store_name:nullの同時送信。履歴からの既存選択・手動登録で共通コールバック使用。
- 過去の保存復旧/ジャーナル/保存直後確認/推薦修正は除外。認証・通常保存・写真原画・DB/RPC/Edge・PWAは基準から変更なし。架空データ/LANサーバーは公開対象外。今回のモックテストファイルも作業領域のみで配信しない。
- 切り出し後の限定確認: Nodeテスト13成功/0失敗（1件は既存16assertionsのファイル）、ブラウザ10+5成功/0失敗/外部要求0。既存102+6成功記録を再利用。保存直後の関連付け1件は未公開機能のため今回対象外。
- index/main/依存JS/CSS参照を?v=20261022-photo500mで統一。新SWなし。公開後に配信バイト一致・正常起動を確認予定。Androidの実関連付けは本人確認待ち。
- 残存制約: 新店舗登録後の関連付け失敗で店舗だけ残り得る。自動削除しない。再取得して既存店舗を選択。異表記店舗の別端末同時登録は完全保証なし。万徳の本番登録/GPSは未確認。
- ロールバック: 本リリースコミットをgit revertして通常pushしPages配信一致を再確認（reset/force push不要）。DB変更がないためDB復旧操作不要。公開完了結果/SHAは後続の記録へ追記。
# Changelog

## 2026-10-16

- `NAVI_STATUS.md` を現在状態の正本として新設。
- `AGENTS.md` に状態・テスト・公開確認の記録ルールを追加。
- 既存アプリコードの変更なし。

## 既存履歴

このファイル作成以前の履歴はGitコミット履歴を参照する。未検証の内容は遡って完了扱いにしない。

## 2026-10-16 公開基準の再確認（文書のみ・未push）
- 公開0d7cdb543128f46fa1f0033d8eee25fea6ab69ea／Pages38851087792成功を確認。ランタイム39資産はf553efa時点から不変・公開内容一致。Edge v22 ACTIVE。
- 本番ゲスト検索・3候補・4ボタン・本人機能拒否を確認。本人OTP以降は今回未確認として分離。履歴6項目編集は公開済み、安全削除は未実装。
- 現行AGENTS指定に従いNAVI_STATUS.mdへ一本化。ローカルHARAKEN_NAV_STATUS.mdは案内へ変更。アプリコード・DB・Auth・公開状態は変更なし。

## 2026-10-17 安全削除（部分適用・公開保留）
- 本人限定の削除確認UI、永続削除ジョブとStorage再試行処理をローカル追加。DB migrationのみ本番適用済み、専用Edge・画面は未公開。
- 関連Node54件最終PASS、実DB一時記録8項目PASS・ROLLBACK。画面3件は未合格、実Storage削除未確認のため停止。既存実記録の削除なし。

## 2026-10-17 安全削除の画面テスト修正
- 写真取得・描画完了前に件数判定していたテストへ表示待ちを追加。画面3件を1回実行し全PASS。製品コード・DB変更・実データ削除・公開なし。実Edge／実Storage確認は次工程。

## 2026-10-17 専用削除Edgeの実環境確認（画面公開保留）
- navi-meal-delete v1 ACTIVE。ゲスト／無効JWTは401、CORS preflightは204、汎用エラー応答のみを確認。
- 本人セッション不足により実Storage削除検証は未実施。一時データ作成なし、既存データ変更なし。画面は未公開。

## 2026-10-17 本人セッションを引き継ぐ削除検証導線
- 31cbd502ec034e98d3db1d6eba75dafa22a28705：internal-delete-test/へ4資産追加。本人照合後、この画面生成の一時UUID・marker・写真だけ検証。一般UI・DB・Edge実装の変更なし。
- 模擬画面3件PASS。実作成・実削除は次工程。正式公開画面へ削除ボタンは追加しない。
- 公開確認：Pages run 39002790591 success、ca725e7の専用4資産200・バイト一致、一般画面関連5資産不変・秘密設定2パス404。同一ブラウザで本人セッション継承成功。実テストデータ作成・削除なし。

## 2026-10-17 実削除テスト途中
- 専用一時記録・合成画像1枚の本番保存成功、保存時の他データ比較一致。削除確認操作でブラウザ制御停止、DB読取で未削除・ジョブ未作成を確認。一時データは次回継続用に残存。実装変更・通常画面公開なし。

## 2026-10-17 安全削除を正式履歴UIへ
- 4d3216b2d287eac894c98e0d3990531808daef75：検証済みの本人限定・確認付き削除と写真未完了時再試行を履歴編集へ反映。写真ありは写真削除も明記。
- 専用一時記録で実Edge削除完了。ユーザー画面で他データ比較一致、SQLでDB行・写真行・Storage不存在／job doneを再確認。実障害注入・実第三者JWTは未確認。
- 通常本物の履歴は削除していない。既存54＋8＋画面3件を不要再実行せず、配信対象3JS構文確認。
- 正式公開確認：f4c3b2a／Pages39004007104成功。変更3JS・manifest一致、秘密設定404。本人正式ページで履歴編集の削除ボタンを確認してキャンセル。実際の履歴削除なし。

## 2026-10-17 Android削除確認（ユーザー報告）
- 正式画面で削除ボタン、確認メッセージ、キャンセル復帰をAndroid実機で確認したとの報告。実データ削除なし。操作ログの独立検証は未実施。コード変更なし。

## 2026-10-17 ボトル情報保持・キープ店固定加点廃止（ローカルのみ）
- 同一店舗候補の統合時に本人ボトル情報を保持し、両RPC形式のIDで重複排除。飲みモードの固定＋8点を削除。
- 新規6件＋関連既存34件、40/40 PASS。GitHub未反映・本番未公開・Android未確認。DB／実データ変更なし。

## 2026-10-17 ボトル保持・固定加点廃止を正式公開
- ae51fedad70704cba837c37d439893a861542977をmainへ反映、Pages39030342041成功。変更2JSと未変更manifestはHTTP200・コミット完全一致。
- 既存40件PASSのコードを変更せず公開。再テストなし。Android確認待ち、今回ゲスト検索の実操作なし。DB／Edge／認証／PWA変更なし。

## 2026-10-18 共通店舗・写真GPS連携
- 共通店舗のジャンル／利用モード／テスト区分、本人専用カタログ、確認付き店舗確定を追加。テスト4店舗は検索・学習参照から除外、物理削除なし。
- 残量ゼロでも本人店舗を候補化。写真GPSの周辺候補と確認付き履歴店舗関連付けを追加。曖昧な過去履歴の一括更新なし。
- ロジック48、DB12（ROLLBACK）、画面6成功。DB適用済み・画面公開準備中。

- 正式公開：ナビ578f06d／Pages39076004968、焼酎38f1e4c／Pages39076023477成功。12資産200・コミット一致、秘密パス404。Android・実本人設定保存は未確認。

## 2026-10-18 具体的料理希望の推薦順位改善
- PR #2 を squash merge：c8f4deb9bf2dfdba10ead8534bb8838829120b86。料理希望「やきとり」を肉の一般候補より優先する判定をdomain.jsへ追加。
- GitHub Actions run 39097899607 success。料理判定7条件・推薦順位4条件のテストを登録。個々の実行ログは今回未確認。
- Android画面で焼き鳥店が1～3位（やきとり ひだか／焼き鳥のあんど／焼鳥 にわ とりのすけ 西新店）となったことを確認。公開配信のコミット一致は未確認。DB・他アプリ変更なし。

## 2026-10-18 ジャンルと料理希望が矛盾する場合のテスト
- PR #3 squash merge：e14eed9ecdb27239cc345a2f524f28d6204d015c。推薦ロジックは変更せず、魚＋やきとり／肉＋寿司／魚のみ／おまかせの回帰条件を追加。
- GitHub Actions run 39098279017 success。Android実機の矛盾条件検索は未確認。

## 2026-10-18 店舗関連付けの店名検索改善
- PR #4 squash merge：fbb76ea7c23c56133c809f21c94fb4f617059232。既存店名の検索欄初期値と表記揺れ吸収を追加。店舗確定は引き続き本人操作のみ。
- GitHub Actions run 39098740055 success。追加6条件の検索テストを含む。DB・実履歴変更なし。公開配信一致／Android確認は未実施。

## 2026-10-18 写真GPS周辺候補の表示修正
- PR #5 squash merge：fea77fe2c87db4a6e56ba242b41d80bdcf24c38c。写真GPS検索時に店名絞り込みを解除して周辺候補を表示。GitHub Actions run 39098851457 success。DB・実履歴変更なし。公開配信一致／Android確認は未実施。

## 2026-10-18 店舗候補順位付け
- PR #6 squash merge：a4bc3751213ed7f13588e69662cd7547e3519f99。店名完全一致・住所一致・GPS距離による候補表示順と一致根拠表示を追加。GitHub Actions run 39099000413 success。住所照合は入力提供時のみ。DB・履歴変更なし。

## 2026-10-18 店舗検索の案内文同期
- PR #7 squash merge：64131e0c2d8725e240d4da2781868d45f2984bee。Androidで発見した、絞り込み解除後も不一致案内が残る問題を修正。GitHub Actions run 39099512864 success。DB変更なし。

## 2026-10-18 写真GPS検索に店名ヒント追加
- PR #8（52c8ea7）：履歴の店名を周辺検索のhintとして送信。CI対象に店舗関連付け2ファイルを追加。Actions run 39100303365 成功。Pages/Android未確認、DB変更なし。

## 2026-10-18 PR #9 手動店舗確認（未公開）
- 写真GPS候補の店名優先、候補にない店舗の住所→地図検索、緯度経度の手動入力・明示的確定・既存API登録を開発ブランチに追加。
- 座標形式・範囲・写真GPSとの完全一致を検証。住所はDB未保存。GitHub Actions run 39101449499 success、Android未確認、PRは2026-10-18マージ済み（当時は準備のみ未公開）、本番DB変更なし。


## 2026-11-09 W-B1 案件2・4 ローカル限定実装
- 案件/作業ID：W-B1/NAVI-02基本定休日除外、NAVI-04推薦理由。
- 状態：両案件の指定変更を実装し限定Node検証成功。バッチ全体は未完了。案件1・3の状況はWB1-LOCAL-IMPLEMENTATION-20261109.md。
- GitHub反映：なし。main基準a84027369fc5e66d3a960191b06bbfa496053546を読取確認。本領域はGit管理外の既存コピー。
- 本番反映：未実施。
- 変更：domain.js（基本定休日分岐、未評価ジャンルの理由1分岐）、discovery.js（closed_weekdays引継ぎ）、新規tests/wb1-recommend.test.mjs。
- 関連未変更：genre-fit.js、SQL/DB、Edge、認証、既存GPSテスト、workflow。
- 検証：新規5テスト成功。specific-dish/recommend-specific既存2ファイル成功。今回全体の失敗・ブラウザ未確認は上記報告で分離。既存当日営業イベントの優先順位は不変・追加検証なし。
- 未反映：全変更ローカルのみ。PR12はDraft/未マージ、CI failure、取り込み保留。
- あんこ独立確認：JST基本定休日・両モード/不明残存・マスタ引継ぎ、未評価理由の量限定とstrong理由維持。公開完了とはしない。


## 2026-11-09 W-B1 残り受け入れ検証完了（ローカル作業記録）
- 案件/作業ID：W-B1案件1〜4・残り受け入れ検証。
- 状態：限定ローカル検証合格。以前の途中結果は履歴として保持。詳細はWB1-ACCEPTANCE-20261109.md。
- GitHub反映：なし。PR12はOpen/Draft/未マージ。既存CIは店名検索・store-navigation失敗、bottle-merge成功。
- 本番反映：未実施。DB/SQL・実検索API・Android確認なし。
- 今回変更：tests/store-link-search.test.mjsのstores fixture追加、tests/wb1-mood.browser.cjsの指定条件・合成候補による受け入れ試験、記録ファイル。製品再実装なし。
- 関連未変更：製品6ファイル、store-navigation、workflow、既存GPSテスト2件は開始時SHA-256と一致。
- 今回検証：関連Nodeテスト19エントリ成功/0失敗、ブラウザ3項目成功/0失敗、構文2ファイル成功。西新・ゲスト・127.0.0.1:8140、検索応答はブラウザ内モック。store-navigation既知失敗は未再実行。内部assert数とは区別。
- 未反映/残作業：ローカル修正未push、CI再確認・main統合・公開は未実施。PR12は必要チェック成功まで保留、NAVI-08/W-B6依存は別作業。W-B2へ自動移行しない。
- あんこ独立確認依頼：店名ヒント純粋順位/外部非送信、気分3操作のモック境界、定休日・理由の最小変更。GitHub反映はユーザー承認後。


## 2026-11-10 W-B1 GitHub反映準備（案件1〜4・未公開）
1. 案件/作業ID：W-B1案件1店名ヒント、案件2基本定休日、案件3気分入力、案件4推薦理由。
2. 作業状態：ローカル実装・限定受け入れ完了。あんこ20261109_WB1_PRE_PUSH_REVIEW_UPDATE_ANKO_v01の判定Aを確認。
3. GitHub反映状態：専用ブランチwork/wb1-20261110へ本差分を反映する。main基準a84027369fc5e66d3a960191b06bbfa496053546と一致。push/CIの実測結果は後続の反映結果記録を参照。PR12はOpen/Draft/未マージを維持。
4. 本番反映状態：未実施。main直接push・マージ・公開・DB/SQL変更なし。
5. 変更ファイル：製品main.js/domain.js/discovery.js/meal-client.js/store-link-ui.js/photo-store-candidates.js、tests/store-link-search.test.mjs、tests/wb1-recommend.test.mjs、tests/wb1-mood.browser.cjs、NAVI_STATUS.md/CHANGELOG.md、W-B1実装・受け入れ報告とブラウザ結果JSON。
6. 関連未変更：tests/photo-direction.test.mjs・tests/photo-gps.test.mjsの既存差異はGitHub反映から除外しローカル保持。既存GPS未追跡3テスト、workflow、store-navigation、DB/SQLも対象外。Git管理外コピーに管理情報のみ追加し作業ファイルをcheckoutせず保全。
7. テスト：今回push前Node関連19エントリ成功/0失敗。2026-11-09のブラウザ3項目成功を再利用（西新/ゲスト/127.0.0.1:8140、検索応答モック、実API成功ではない）。Node24とCI22は区別。store-navigation既知失敗は未修正・未再実行。
8. 未反映・残作業：main統合・公開未実施。PR12のCI緑化はNAVI-08/W-B6別作業。ブラウザテストは既存PCのPlaywright依存パスを使用する手動受け入れ用でCI自動実行対象ではない。
9. あんこ独立確認依頼：本ブランチの案件1〜4差分、GPSテスト混入なし、外部hint非送信、定休日と当日営業イベントの既存優先関係、CI結果を確認。公開版のW-B1確認は公開承認前につき対象外。


## 2026-11-10 W-B1 GitHub反映結果（未マージ・未公開）
1. 案件/作業ID：W-B1案件1〜4。
2. 作業状態：限定ローカル受け入れ完了、GitHub専用ブランチ反映完了。独立コード確認待ち。
3. GitHub反映状態：work/wb1-20261110、実装コミット7b0ec4fb244c218aea4167342ef55c2ee5029347のpush成功。Draft PR #13 https://github.com/haraken59-bot/haraken-navi/pull/13 。mainはa84027369fc5e66d3a960191b06bbfa496053546のまま。PR #12は未変更・Open/Draft/未マージ。
4. 本番反映状態：未実施。main統合、Pages公開、DB/SQL変更なし。
5. 変更ファイル：製品6（main.js、domain.js、discovery.js、meal-client.js、store-link-ui.js、photo-store-candidates.js）、テスト3（store-link-search.test.mjs、wb1-recommend.test.mjs、wb1-mood.browser.cjs）、NAVI_STATUS.md、CHANGELOG.md、WB1-LOCAL-IMPLEMENTATION-20261109.md、WB1-ACCEPTANCE-20261109.md、WB1-MOOD-ACCEPTANCE-20261109.jsonの計14。
6. 関連未変更：既存GPS差異tests/photo-direction.test.mjs・tests/photo-gps.test.mjsを除外し保持。GPS未追跡3件、workflow、store-navigationも保全。作業前全ファイルのSHA-256は追記対象2文書以外一致。文書はmain履歴にW-B1のみ追加し、ローカルのGPS履歴差異は反映していない。
7. テスト：push前の限定Nodeテスト19成功/0失敗。ブラウザ3項目の前回モック成功を再利用。実装コミットCI run42668530156/job129338563451成功（Node22、構文・specific-dish・recommend-specific・store-link-search）。CIにはW-B1追加テストやbottle/store-navigationは含まれず、ローカル結果・PR12の既存CIと区別する。
8. 未反映・残作業：main未統合・未公開。PR12のstore-navigation既知失敗はW-B6。追加修正・テスト無効化なし。ブラウザ依存パスは既存PC専用、Android/本番検索は未検証。
9. あんこ独立確認依頼：PR13の14ファイル差分と実装コミット、CI run42668530156、外部hint非送信、GPS除外、当日営業イベントと定休日の優先関係を確認。mainや公開版にW-B1が反映済みと扱わない。マージ・公開は別途承認。


## 2026-11-10 W-B1 PR13マージ・本番公開（最新到達状態）
1. 案件/作業ID：W-B1案件1〜4。独立確認20261110_WB1_PR13_INDEPENDENT_REVIEW_ANKO_v01の判定Aとユーザー承認に基づく。
2. 作業状態：PR13をsquash merge、main反映・本番配信・限定公開確認完了。W-B6/NAVI-05には未着手。
3. GitHub：承認head036a8820818a9298648fd36900396bdede43568b、実装7b0ec4fb244c218aea4167342ef55c2ee5029347。マージ/製品公開コミットa0b95cbf158f4d50d9407918ad983ce21f32b4fc。承認headとmainのtree一致。差分14ファイルのみ。PR12はOpen/Draft/未マージ、head e543a18fe5ccf7f08d163aec4c9a6376ca88ed05で未変更。
4. 本番： https://haraken59-bot.github.io/haraken-navi/ 。既存main連動GitHub Pages run42698362051成功。設定・workflow変更なし。本記録更新は製品変更を伴わない。DB/SQL・認証・保存済みデータ変更なし。
5. 対象：製品6、テスト3、状態/履歴2、報告/証跡3はPR13の範囲。公開後は本STATUS/CHANGELOGのみ更新。GPSテスト2件と既存未追跡ファイル・ローカル履歴差異は保全。
6. 検証：承認head CI run42668694157成功を再利用。main自動Recommendation CIは既存workflowの対象外（別run成功と偽らない）。mainは承認headと同一tree。今回追加の定休日/当日open/当日closed優先3assert成功。既存Node19成功とブラウザモック3成功は再実行せず継承。
7. 公開実測：HTML+製品6ファイル計7件HTTP200・承認内容とバイト一致。390px幅の新規ゲストブラウザ、西新/焼き鳥、実API GET2回HTTP200、推薦生成・再タップ保持・モード切替リセット・今どうする気分保持と3候補表示成功。pageerror0、書込要求0。取得上限/通信制限による一部結果の案内あり。配信済み純粋関数の合成データ4条件（店名順位・定休日・当日open優先・量限定理由）も成功。実店舗の定休日データや本人の写真検索結合は未検証。
8. 未確認/既知失敗：Android実機・既存端末キャッシュ・ログイン/実保存は未検証。W-B6既知6件（photo-gps2、photo-direction2、jpeg-ref-diagnostics1、store-navigation1）は独立報告の既存失敗として保持し未修正・未再実行。テスト無効化なし。店名ヒント外部非送信はコード照合、順位は純粋関数確認であり実写真検索の成功とはしない。
9. あんこ公開後独立確認：PR13、製品公開コミット、CI42668694157、Pages42698362051、公開URL、WB1-PRODUCTION-CHECK-20261110.jsonを照合。次案件への移行・追加修正・ロールバックなし。


## 2026-11-10 NAVI-05仕様B・アルファA・ベータA／GEO-03（レビュー用ブランチ）
1. 案件/作業ID：NAVI-05＋GEO-03。正本20261110_NAVI05_WORK_IMPLEMENTATION_INSTRUCTION_ANKO_v01.md（Drive 1MPpXHjm303MQR2KbDXIrJWCHRWsM3F-M）。
2. 作業状態：ローカル実装・指定テスト成功。Android実機は未確認。開始時GitHub mainは指定2e133f271b6cecb6b97f4c7b557a989ad17bc3c8と一致。既存作業コピーのHEAD036a882は移動せず、対象3ファイルに既存変更なしと確認。文書の既存履歴差異は保全。
3. GitHub反映状態：main 2e133f271b6cecb6b97f4c7b557a989ad17bc3c8を基準にfix/navi05-geo03-20261110でレビュー対象。マージ・公開は未承認。PR CIはPR側で確認する。
4. 本番反映状態：未公開、DB/SQL/Edge変更なし。実API・Auth通信なし。
5. 今回変更：genre-fit.js（非ジャンル意図→ボタン→自由入力の順、rules/dishesへ指定ひらがな3語のみ追加）、tests/recommend-specific.test.mjs（既存8assert維持＋11assert追加）、api.js（開発origin配列から指定ngrokのみ削除）、NAVI_STATUS.md/CHANGELOG.md（NAVI-09/10訂正・§11仕様B引継ぎ・完了記録）。
6. 関連未変更：domain.jsのdesireMatch/specificDishMatch、genreFit本体/clean、W-B1製品箇所、discovery、Edge/SQL、GPS既存差異、W-B6、PR12。既存未追跡ファイルも保持。
7. 検証：公式Node v22.23.4の一時実行環境、CIと同じ--experimental-default-type=module --testで3スイート成功/0失敗。recommend-specific既存8件（競合2件含む）＋追加11assert成功。GEO-03はモックfetchで本番/localhost/127.0.0.1/除去originの4ケース成功、製品ngrok残存0、変更JS/テスト3ファイル構文成功。Node24ではCIフラグ非対応だったため実テストには使用せず、システム設定は変更していない。
8. 未確認/制限：Android（肉ボタン＋魚が食べたい等）、公開/実API、Edgeのhint/category仕様は未確認。料理名グループ外（刺身等）の独立照合は保証しない。GEO-03は環境分岐のモック確認で実認証の確認ではない。W-B6既知6失敗は未実行・未修正。
9. あんこ独立確認：20261110_NAVI05_GEO03_POST_EVIDENCE_REVIEW_ANKO_v01.mdは判定A、3スイート・既存8・追加11・GEO-03の4条件を独立再現済み。次はPR差分の独立確認とユーザー承認待ち。
