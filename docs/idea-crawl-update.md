# Cập nhật kho thẻ Idea Crawl

Kho nằm ở `dashboard/idea-crawl.html`. Đây là bản **cộng dồn**: mỗi ngày thêm thẻ mới, mọi ngày cũ vẫn còn. Không thay cả file bằng HTML của một ngày.

Trang công khai (sau khi bật GitHub Pages từ nhánh `main`, thư mục `/`):

- Kho tổng: https://iamhtv.github.io/sideproject/
- Kho thẻ: https://iamhtv.github.io/sideproject/dashboard/idea-crawl.html

Ngày tính theo lịch **Asia/Saigon**.

## Nguồn dữ liệu duy nhất

Mọi thẻ nằm trong mảng `IDEA_DAYS`, giữa hai marker:

```javascript
// IDEA-DAYS-START
var IDEA_DAYS = [ /* ngày mới nhất đứng đầu */ ];
// IDEA-DAYS-END
```

Phần HTML, CSS và hàm render **ở ngoài** hai marker. Lượt cập nhật chỉ được sửa khối này (tay hoặc bằng script bên dưới). Thanh ngày, chip mảng, số thẻ đều sinh từ mảng — không sửa nav bằng tay.

Mỗi phần tử là một ngày:

```json
{
  "date": "2026-11-03",
  "tz": "Asia/Saigon",
  "label": "03/11",
  "heading": "Thứ Ba, 03/11/2026",
  "note": "Game 5 · Web Distill 5 · FB 3 · Webapp AI 5",
  "cards": [
    {
      "id": "2026-11-03-c1",
      "track": "game",
      "title": "Tên thẻ",
      "preview": "Một đến ba câu hiện trên mặt thẻ.",
      "fields": [["Nhãn", "HTML chi tiết, có thể chứa <a href=\"...\">link</a>"]],
      "score": null,
      "star": false
    }
  ]
}
```

Quy ước:

- `track` chỉ được là `game`, `distill`, `fb`, hoặc `webapp`.
- `id` phải duy nhất trong cả kho và bắt đầu bằng ngày: `2026-11-03-c1`, `2026-11-03-c2`, … Không tái sử dụng id của ngày khác. Đổi id của thẻ đã phát hành sẽ làm máy đã bấm Duyệt mất trạng thái (localStorage khoá `htv-idea-crawl-approvals`).
- `fields` là các cặp `[nhãn, html]`. HTML trong ô thứ hai được gắn nguyên vào mục Chi tiết (link nên có `target="_blank"` và `rel="noopener"`). Nhãn và tiêu đề là chữ thường, không phải HTML.
- `score`: `null` (thường dùng cho Game) hoặc số. Distill dùng số nguyên 1–5 (hiện sao). Các mảng khác hiện dạng `x/10`.
- `star: true` chỉ khi muốn viền vàng và nhãn **LÀM NGAY**.
- Ngày mới nhất đứng **đầu** mảng. Script merge tự sắp theo `date` giảm dần.

## Cách merge (không xoá ngày cũ)

Lưu object **một ngày** (không bọc thêm mảng) thành `ngay-moi.json`, rồi từ gốc repo:

```bash
node scripts/merge-idea-day.js ngay-moi.json
```

Script chỉ việc:

1. Đọc đúng khối giữa `IDEA-DAYS-START` và `IDEA-DAYS-END`.
2. Nếu `date` chưa có: thêm ngày đó. Nếu `date` đã có: thay đúng object ngày đó (sửa trong ngày).
3. Giữ nguyên từng byte dữ liệu của các ngày khác. Nếu phép ghi làm mất hoặc sửa một ngày khác, script thoát lỗi và không ghi file.
4. Từ chối id trùng, track lạ, hoặc id không gắn với `date` của ngày đó.
5. Sắp ngày mới nhất lên đầu.

Sửa file kho khác để thử: `node scripts/merge-idea-day.js ngay-moi.json --html /đường/dẫn/idea-crawl.html`.

Không chạy script này với một file HTML crawl một ngày. Đầu vào là JSON một ngày, đúng khung ở trên.

## Sửa tay (khi không chạy được script)

1. Mở `dashboard/idea-crawl.html`, tìm `IDEA-DAYS-START`.
2. Chèn object ngày mới vào **đầu** mảng `IDEA_DAYS`. Giữ nguyên mọi object phía dưới.
3. Đừng xoá marker, đừng đổi `var IDEA_DAYS`, đừng đụng CSS/JS bên ngoài.
4. `id` của thẻ mới theo dạng `YYYY-MM-DD-cN`.
5. Mở trang, kiểm tra thanh **Các ngày** có thêm chip mới, tab Chờ duyệt vẫn còn thẻ của ngày cũ.

## Kiểm tra trước khi đẩy

- Số thẻ sau cập nhật = số thẻ trước + số thẻ ngày mới (trừ khi đang sửa một ngày đã có — khi đó các ngày khác giữ nguyên số thẻ).
- Chuỗi ngày cũ, ví dụ `2026-11-02`, vẫn còn trong file.
- Mỗi `id` xuất hiện đúng một lần.
- Bốn chip mảng vẫn lọc đúng, mục **Chi tiết** vẫn mở được, nút **Duyệt** chuyển thẻ sang tab Đã duyệt (trạng thái chỉ nằm trên trình duyệt).

## GitHub Pages

Site phục vụ từ nhánh `main`, thư mục gốc `/` (`index.html` ở root). File `.nojekyll` để Pages trả HTML tĩnh, không chạy Jekyll.

Bật một lần (nếu chưa bật): repo **Settings → Pages → Build and deployment → Deploy from a branch →** Branch `main`, folder `/ (root)` → Save.

API tương đương, bằng tài khoản có quyền admin repo:

```bash
gh api --method POST repos/iamHTV/sideproject/pages \
  -f build_type=legacy \
  -f source[branch]=main \
  -f source[path]='/'
```

Kho chỉ xuất hiện trên URL công khai sau khi commit đã nằm trên `main`.
