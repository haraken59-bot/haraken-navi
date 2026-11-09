# W-B1 ローカル実装・限定検証（2026-11-09）

状態：一部完了、未公開。案件2・4はローカル限定確認成功。案件1・3は受け入れ条件未完了。

## 基準と保全
- 共有原本 20261109_HarakenNavi_先行バッチWork実装指示書_あんこ_v01.md を全文確認。復元報告・進捗報告・バッチ整理・NAVI08切分けも参照。
- GitHub mainを読み取り確認：a84027369fc5e66d3a960191b06bbfa496053546。
- 既存領域 work/gps-common-navi-release-20261030 を使用。Git管理外コピーのためローカルbranch/HEAD/未コミット判定なし。新規作業環境・Git初期化なし。
- 着手前mainの76ファイルとblob hash比較：72一致、4差異（NAVI_STATUS.md、CHANGELOG.md、tests/photo-direction.test.mjs、tests/photo-gps.test.mjs）、欠落0。今回対象製品6ファイルとworkflow1ファイルは完全一致。上記GPSテスト2本は保持、記録は履歴維持。
- outputs/navi-release、recovery-five、gps-integrationの既存未コミット変更は別作業として保全。古い検索/保存/GPS成果を丸ごと移植していない。

## 案件別
1. 店名ヒント：photoStoreSearch(point,name)、UIからinitialName引渡し、統合後の純粋rankPhotoStoresを実装。NFKC/60文字、部分一致優先・距離順・候補削除なし・20件制限なし。searchPhotoOsm(point)呼出しは変更なし。GPS/500m処理不変。並べ替え7assert成功。ただしクライアント/UI結合と既存手動登録回帰は未完了。
2. 定休日：operatingの既存一致分岐をavailable:falseへ、buildPoolのマスタclosed_weekdays引継ぎ追加。食事/飲み、営業日/不明/空、JST曜日、外部候補統合、0候補を3テストで確認。既存の当日イベント判定優先順は変更していない（open確認がある場合の優先順位は今回追加検証していない）。
3. 気分：mode同一選択はfields後return、startNowはリセット前後のdesire退避復元。ブラウザで入力欄/context保持は確認、結果生成がnullで後続の結果保持・モード切替確認に到達できず。製品原因か試験条件かは未確定。完了扱いしない。
4. 理由：genre_fit=null/portion_fit=fitの1分岐を量のみの表現へ。未評価とstrongの2テスト成功。順位/genre-fitロジック変更なし。

## テスト結果
- Node v24.19.0。CI Node22と異なる。Node24では--experimental-default-type=moduleを付けず実行。
- node --test tests/wb1-recommend.test.mjs tests/specific-dish.test.mjs tests/recommend-specific.test.mjs tests/store-link-search.test.mjs tests/photo-store-candidates.test.mjs：12 test entries成功、1失敗。内訳：新規5、既存候補5、既存specific/recommend各ファイル1成功。assert数とは別。
- 初回はテスト編集コマンドの相対パス誤りで旧静的assertが残ったまま実行。編集処理のパスを訂正し、指定2assertだけ置換した後store-link-searchのみ再実行：0成功/1失敗。今度は既存手動登録fixtureにclient.storesがなくTypeError。旧静的assertの失敗と区別。許可外の既存fixture修正はせず停止。
- rankPhotoStores：別のインラインNode動作検証7assert成功（上記スイートは途中停止のため末尾の追加assert未到達）。
- 構文：変更ソース/テスト9ファイルnode --check成功。
- browser：通常sandboxで起動失敗1回。承認レビュー経由のsandbox外ローカル実行では起動成功、入力/context保持確認後、推薦結果nullのassert失敗1件。後続2ケース未到達。外部要求はrouteで遮断。テスト用mainへの観測getterはメモリ上のみで製品ファイルには追加しない。
- store-navigation/bottle-mergeは今回再実行なし。前者はNAVI08/W-B6既知失敗、後者は過去成功証拠のみ。今回成功数に含めない。

## PR12
- Open/Draft/未マージ、head e543a18fe5ccf7f08d163aec4c9a6376ca88ed05。
- 変更1ファイル .github/workflows/recommendation-tests.yml。案件1〜4の製品ファイルとの重複なし。
- 実CI run40150984348/job121042306482：failure。syntax/specific/recommend/bottle成功、store-link-search/store-navigation失敗。
- workflow変更は今回まだ取り込まない。チェック緩和・テスト無効化・PR更新・マージなし。W-B6のstore-navigation対応が緑化に必要。

## 変更ファイル
- main.js、domain.js、discovery.js、meal-client.js、store-link-ui.js、photo-store-candidates.js
- tests/store-link-search.test.mjs（旧静的assert2件のみ置換、その他既存assert保持）
- 新規tests/wb1-recommend.test.mjs、tests/wb1-mood.browser.cjs
- NAVI_STATUS.md、CHANGELOG.md（案件2・4の結果のみ追記）
- 本報告 WB1-LOCAL-IMPLEMENTATION-20261109.md

## 次の最小作業
- 案件1：store-link-searchの既存手動登録fixtureへstoresスタブを追加してよいか範囲確定。store-navigationは触らない。ヒントのclient/UI統合、外部送信なしの動作確認が残る。
- 案件3：ブラウザの推薦結果nullを試験条件から切り分け、3操作受け入れ確認。気分以外の条件維持も確認。
- W-B2：W-B1完了、別承認のmain反映、あんこの独立確認後。W-B6はGPS優先順位仕様の確認も必要。PR12の緑化依存があるため順序はChatで整理し、自動移行しない。
- GitHub読取のみ。commit/push/PR変更/merge/deploy、本番API通信、DB/SQL/Edge/認証変更0。別案件のGPS・Geoapify・genre-fitは変更なし。
