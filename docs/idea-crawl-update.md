# Gắn thẻ idea vào từng dashboard

Mỗi ngày (lịch **Asia/Saigon**) thêm 3–5 thẻ cho từng mảng vào **đúng file dashboard**. Bốn kho giữ schema và tab sẵn có. Không gộp về một file.

| Mảng | File | Chỗ thẻ mới xuất hiện |
| --- | --- | --- |
| `game` | `dashboard/game.html` | Đầu mảng `IDEAS` (mục idea chờ duyệt) |
| `distill` | `dashboard/web-distill.html` | Đầu lưới, ngay dưới marker `BATCH_MOI` |
| `fb` | `dashboard/quet-facebook.html` | Ngày mới trên cùng (nav, thẻ nhìn nhanh, section) |
| `webapp` | `dashboard/webapp-ai.html` | Đầu `#idea-grid` (sắp xếp mặc định “Mới nhất trước”) |

Substack không nhận thẻ idea này.

Trang công khai (GitHub Pages, nhánh `main`, thư mục `/`):

- Kho Tổng: https://iamhtv.github.io/sideproject/
- Game: https://iamhtv.github.io/sideproject/dashboard/game.html
- Substack: https://iamhtv.github.io/sideproject/dashboard/substack-iamhtv.html
- Web Distill: https://iamhtv.github.io/sideproject/dashboard/web-distill.html
- Quét Facebook: https://iamhtv.github.io/sideproject/dashboard/quet-facebook.html
- Webapp AI: https://iamhtv.github.io/sideproject/dashboard/webapp-ai.html

`dashboard/idea-crawl.html` chỉ là bản lưu lượt 02/11/2026. Kho Tổng không dẫn tới file đó. Đừng thêm ngày mới vào `IDEA_DAYS`.

## JSON một ngày

Đầu vào của script là **một object ngày**, không phải file HTML. Thẻ mới nhất không cần bọc thêm mảng.

```json
{
  "date": "2026-11-03",
  "tz": "Asia/Saigon",
  "label": "03/11",
  "heading": "Thứ Ba, 03/11/2026",
  "cards": []
}
```

Mỗi thẻ:

- `id` duy nhất, bắt đầu bằng ngày: `2026-11-03-c1`.
- `track`: `game`, `distill`, `fb`, hoặc `webapp`.
- `title`, `preview` (chữ thường, không phải HTML).
- `fields`: các cặp `[nhãn, html]`. HTML giữ link có `target="_blank"` và `rel="noopener"`.
- `score`: `null` hoặc số. Distill dùng số nguyên 1–5. FB và webapp dùng số (webapp hiện dạng `x/10`).
- `star`: `true` hoặc `false`. `true` trên game thành cờ sao; trên webapp thành chữ **LÀM NGAY** trong Chi tiết.

Mỗi track **có mặt** trong file phải có từ 3 đến 5 thẻ. Track không có thẻ thì bỏ qua dashboard đó. Không có track thứ năm.

Nhãn `fields` mà script đọc:

- Game → `Mechanic gốc`, `Twist`, `Vai người chơi`, `Độ khó · thời gian`, `Kênh · ra tiền`. Ghi vào `IDEAS`: `name` = title, `from` = cụm in đậm đầu của mechanic, `round` = `Lượt DD/MM/YYYY`, `time` = độ khó, `play` = preview + twist + vai + kênh + mọi link trong fields. `mid` là id đánh dấu (`i-N`), script tự gán để thẻ cũ không đổi `localStorage`.
- Distill → `Nguồn gốc…`, `Format chính`, `Ra tiền`. `score` ghi vào `data-stars`. `preview` là dòng tóm tắt.
- FB → `Vấn đề…`, `Tín hiệu…` (nếu có) thành ô vấn đề; `preview` + `Offer…` + `Khác thẻ…` + `Rủi ro` thành ô ý tưởng. Đúng khung một ngày của trang quét Facebook.
- Webapp → `Tệp…`, `Nỗi đau…` hoặc `Tín hiệu…`, `Form…`, `Ra tiền`, `Độ khó…`. Chip tệp lấy cụm đầu của câu tệp. `data-stt` nối tiếp số lớn nhất đang có.

## Lệnh

Từ gốc repo, sau khi lưu object ngày thành `ngay-moi.json`:

```bash
node scripts/merge-idea-day.js ngay-moi.json
```

Script:

1. Chia thẻ theo `track` và ghi vào bốn file ở bảng trên.
2. Chèn ngày mới lên đầu danh sách chờ của từng kho. Thẻ cũ giữ nguyên nội dung và id.
3. Nếu `date` đã có trong một kho: thay đúng block của ngày đó (marker `IDEA-DAY-YYYY-MM-DD`), không thêm bản sao.
4. Từ chối track lạ, id trùng, id không gắn với `date`, hoặc track có ít hơn 3 / nhiều hơn 5 thẻ.
5. Cập nhật số đếm gắn sẵn trên trang (idea chờ duyệt, tổng webapp, ngày cập nhật). Distill và Facebook tự đếm bằng JS khi mở trang.

Chạy lại cùng một file JSON không được làm đổi thẻ của ngày khác. Nếu script báo ngày khác bị sửa, nó thoát lỗi và không ghi file đó.

## Sửa tay (khi không chạy được script)

Chỉ thêm block, đừng xoá thẻ cũ, đừng đổi `data-id` / `data-stt` / `mid` đã phát hành.

1. Game: dán object mới vào đầu `var IDEAS` trong `dashboard/game.html`. Mỗi object có `name`, `from`, `round`, `time`, `play`, và `mid` mới (không trùng). Sửa số “idea chờ duyệt” và số trên tab đầu.
2. Distill: dán `<article class="card">` ngay dưới comment `BATCH_MOI`. `data-batch` tăng tiếp, `data-id` tăng tiếp, `data-date` dạng `DD/MM/YYYY`.
3. Facebook: thêm link ngày dưới `DAY-NAV`, thẻ nhìn nhanh dưới `QUICK-ROWS`, `<section class="day">` dưới `DAY-SECTIONS`.
4. Webapp: dán `<article class="idea-card">` ngay sau `<main id="idea-grid">`. Cập nhật `#total-ideas`, `#total-batches`, `#last-updated`.

## Kiểm tra trước khi đẩy

- Mỗi dashboard vẫn còn một thẻ cũ (ví dụ game còn “Mật khẩu phải qua ải sếp”, distill còn batch 8, Facebook còn `d2026-10-25`, webapp còn `#1`).
- Thẻ của ngày mới đứng trước các thẻ đó.
- Link trong Chi tiết là link đã có trên thẻ nguồn.
- Tab Quan tâm / Đã làm vẫn bấm được. Trạng thái vẫn nằm ở `localStorage` của từng trang (`kho-game-marks`, `kho-distill-state-v1`, `kho-facebook-state-v1`, `kho-webapp-state-v1`).

## GitHub Pages

Site phục vụ từ nhánh `main`, thư mục gốc `/`. File `.nojekyll` để Pages trả HTML tĩnh.

Bật một lần (nếu chưa bật): repo **Settings → Pages → Build and deployment → Deploy from a branch →** Branch `main`, folder `/ (root)` → Save.

Kho chỉ đổi trên URL công khai sau khi commit đã nằm trên `main`.
