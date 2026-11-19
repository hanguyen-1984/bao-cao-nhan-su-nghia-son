# Hệ thống báo cáo nhân sự hằng ngày – NM1 / NM2 Đồ gỗ Nghĩa Sơn

Hệ thống thay cho file `Mau_nhap_so_lieu_nhan_su_hang_ngay_NM1_NM2_2.xlsx` và gồm 4 phần:

1. Form nhập liệu theo xưởng.
2. Báo cáo ngày / tháng / theo bộ phận / tình trạng nhập.
3. Dashboard.
4. Trang quản trị để nhập bù và xem lịch sử.

Dữ liệu được lưu trên **Google Sheet**. Giao diện chạy trên **GitHub Pages**.

```
GitHub Pages (giao diện tĩnh)  ──POST JSON──▶  Google Apps Script Web App  ──▶  Google Sheet
index.html, js/, css/                         apps-script/Code.gs + Core.gs     DanhMuc, NguoiDung, NhapLieu,
                                              (đăng nhập PIN, khóa ngày,        LichSu, CauHinh, NgayNghi
                                               kiểm tra số liệu, báo cáo)
```

Khi `js/config.js` chưa có `API_URL`, trang chạy ở **chế độ DEMO** với dữ liệu giả lập ngay trong trình duyệt. Có thể dùng chế độ này để xem thử trước khi nối Google Sheet.
Tài khoản demo: `ADMIN`, `BGD`, `NM1-VP`, `NM1-X1`, `NM1-X2`, `NM1-KHO`, `NM2-VP`, `NM2-X1`, `NM2-X2`, cùng PIN `123456`.

---

## 1. Quy tắc nghiệp vụ

| Nội dung | Cách hệ thống xử lý |
|---|---|
| **Không nhập lùi, không nhập trước** | Form không có ô chọn ngày. Ngày được lấy theo **giờ máy chủ Google, múi giờ Việt Nam**, nên đổi giờ trên máy người nhập cũng không lách được. Nếu form mở từ hôm trước rồi đến sau 0:00 mới bấm gửi thì hệ thống từ chối và tải lại số liệu của hôm nay. |
| **Giờ chốt** | Mặc định 23:59 (`CauHinh` › `GIO_CHOT`). Quá giờ chốt thì form khóa. |
| **Sửa trong ngày** | Được sửa trước giờ chốt (`CHO_SUA_TRONG_NGAY = TRUE`). Nếu đặt `FALSE` thì mỗi bộ phận chỉ gửi được 1 lần/ngày. |
| **Ngày đã qua** | Chỉ **Admin** được nhập bù, sửa hoặc xóa, và **bắt buộc ghi lý do**. Mỗi thao tác được ghi vào sheet `LichSu` (giá trị trước, giá trị sau, người làm, thời điểm). |
| **Ô mặc định 0** | Mọi ô số mặc định là 0, không bắt buộc nhập. Bấm **Gửi số liệu** thì các bộ phận chưa đổi gì cũng được ghi 0 và tính là đã báo cáo. |
| **Các trường nhập (cấu trúc v2, 11/2026)** | **Nghỉ phép** (chính thức / thời vụ) = tổng số người vắng, thay cho Phép năm, Không phép, Ốm, Thai sản, Việc riêng. **Tăng cường**: đi tăng cường / đến tăng cường. **Nhân sự mới**, **Nghỉ việc** (chính thức / thời vụ). **Tăng ca**: số người và tổng số giờ của bộ phận (bước 0,5 giờ). |
| **Kiểm tra số liệu** | Số nguyên ≥ 0 (riêng giờ tăng ca nhận số lẻ 0,5). Nghỉ phép chính thức / thời vụ không lớn hơn quân số chính thức / thời vụ trong ngày; nghỉ việc không lớn hơn quân số; đi tăng cường không lớn hơn số hiện diện; có giờ tăng ca thì phải có số người tăng ca. Chỉ cảnh báo (không chặn) khi tăng ca nhiều hơn số người thực tế làm việc, có người tăng ca mà chưa nhập giờ, bình quân trên 12 giờ/người, hoặc tỷ lệ chuyên cần dưới 90%. |
| **Quân số cuốn chiếu** | Quân số đầu ngày bằng quân số cuối ngày của lần nhập gần nhất trước đó: đầu ngày + mới − nghỉ việc, tách riêng chính thức và thời vụ. Quân số của mỗi ngày được **lưu lại cùng dòng dữ liệu**, nên sửa danh mục không làm đổi số liệu các ngày đã qua. |
| **Chỉnh quân số gốc** | Sửa `Chính thức gốc` / `Thời vụ gốc` trong `DanhMuc`, điền `Áp dụng từ` (yyyy-mm-dd), rồi chạy menu **Nhân sự NS › Tính lại quân số cuốn chiếu**. Các ngày trước ngày áp dụng giữ nguyên. |
| **Cách tính** (giữ như file Excel) | Quân số trong ngày = đầu ngày + mới − nghỉ việc. Hiện diện = quân số trong ngày − nghỉ phép (CT + TV). Tỷ lệ chuyên cần = hiện diện ÷ quân số trong ngày. Tỷ lệ chỉ tính các bộ phận đã nhập. **Tăng cường chỉ ghi nhận, không tính vào tỷ lệ**: Thực tế làm việc = hiện diện − đi tăng cường + đến tăng cường. |
| **Kho Thanh Bình** | Thuộc NM1 và được hiển thị thêm một dòng riêng (cột `Hiển thị riêng` trong `DanhMuc`). Bộ phận nào khác cần hiển thị riêng thì tick cột này. |
| **Ngày nghỉ** | `NGAY_NGHI_TUAN` (mặc định CN) và sheet `NgayNghi` (ngày lễ) chỉ dùng để nhắc "chưa nhập". Ngày nghỉ mà có đi làm thì vẫn nhập được. |

## 2. Người dùng và phân quyền

| Vai trò | Quyền |
|---|---|
| `NHAP` | Nhập số liệu hôm nay cho các bộ phận trong phạm vi được giao. Xem dashboard và báo cáo. |
| `XEM` | Chỉ xem dashboard và báo cáo (dành cho Ban Giám đốc). |
| `ADMIN` | Có mọi quyền, cộng thêm nhập bù / sửa / xóa ngày cũ và xem lịch sử. |

**Phạm vi** (cột `Phạm vi` trong `NguoiDung`) là danh sách mã cách nhau bằng dấu phẩy:

- `*` là tất cả.
- `NM1` là cả nhà máy.
- `NM1-X1` là một nhóm (xưởng).
- `NM1-11` là một bộ phận cụ thể.

**Nhóm (cột `Xưởng` trong `DanhMuc`)** được lấy theo cách chia bạn đã điền trong file Excel. Trong sheet chỉ cần ghi mã ngắn, hệ thống tự ghép với đơn vị (ví dụ `X1` của NM1 thành `NM1-X1`).

| Nhóm | NM1 | NM2 |
|---|---|---|
| `VP` – Văn phòng | BGĐ, Kế toán, Nhân sự, KD B2B, Kỹ thuật, Kế hoạch, XNK (7) | BGĐ, Kế toán, Nhân sự, KD Ecom, Kỹ thuật, Kế hoạch, XNK (7) |
| `X1` – Xưởng 1 | QĐ-Cơ điện, Tài xế, Nguyên liệu, TCBG, Lắp ráp, Nhúng dầu, Đóng gói, QC, Thống kê-Xe nâng-Kho, Lò sấy-Bảo vệ-Tạp vụ (10) | QĐ-Cơ điện, Tài xế, Nguyên liệu, Sơ chế, TCVS, Nhúng dầu, QC, Thống kê-Xe nâng-Kho, Lò sấy-Bảo vệ-Tạp vụ (9) |
| `X2` – Xưởng 2 | TCVS (1) | TCBG, Lắp ráp, Nhúng dầu vỉ, Đóng gói, Mẫu (5) |
| `KHO` – Kho | Kho Thanh Bình (1) | – |

Khi khởi tạo, hệ thống tạo sẵn 9 tài khoản, mỗi nhóm một tài khoản nhập: `ADMIN`, `BGD` (chỉ xem), `NM1-VP`, `NM1-X1`, `NM1-X2`, `NM1-KHO`, `NM2-VP`, `NM2-X1`, `NM2-X2`.
Nếu một người phụ trách nhiều nhóm, sửa cột `Phạm vi` của tài khoản đó, ví dụ `NM1-X1,NM1-KHO`, rồi bỏ tick `Đang dùng` ở tài khoản không cần.
Menu **Nhân sự NS › Kiểm tra cấu hình** liệt kê các bộ phận chưa gán nhóm và các bộ phận chưa có người nhập.

> Một bộ phận **chưa gán nhóm** thì người nhập của bất kỳ nhóm nào trong cùng nhà máy đều thấy. Khi thêm bộ phận mới, nhớ điền cột `Xưởng`.

PIN được lưu ở dạng mã hóa SHA-256 có salt. Nhập sai 5 lần thì tài khoản bị khóa 15 phút. Phiên đăng nhập kéo dài tối đa 6 giờ.

---

## 3. Triển khai (khoảng 20 phút)

### Bước 1 – Google Sheet và Apps Script
1. Tạo một Google Sheet mới, đặt tên ví dụ "BC Nhân sự Nghĩa Sơn". **Chỉ chia sẻ sheet này cho Phòng Nhân sự.**
2. Vào **Tiện ích mở rộng › Apps Script**.
3. Mở **Cài đặt dự án (⚙)**, tick **"Hiển thị tệp kê khai appsscript.json"**, rồi dán nội dung `apps-script/appsscript.json` vào tệp đó.
4. Dán nội dung `apps-script/Code.gs` vào tệp `Code.gs`.
5. Bấm **+ › Tập lệnh**, đặt tên `Core`, rồi dán nội dung `apps-script/Core.gs` vào.
6. Lưu lại. Quay về Sheet và tải lại trang. Menu **Nhân sự NS** sẽ xuất hiện.
7. Chọn **Nhân sự NS › 1. Khởi tạo hệ thống** rồi cấp quyền khi Google hỏi. Hệ thống sẽ tạo đủ 6 sheet, nạp sẵn 40 bộ phận kèm nhóm (VP/X1/X2/KHO) từ file Excel và 9 người dùng.
   **Ghi lại PIN ban đầu** trong hộp thoại vì PIN chỉ hiện một lần. Sau này cần cấp lại thì dùng menu *Cấp PIN mới*.

### Bước 2 – Xuất bản Web App
1. Trong Apps Script, chọn **Triển khai › Tùy chọn triển khai mới**, loại **Ứng dụng web**.
2. Đặt **Thực thi với tư cách: Tôi** và **Người có quyền truy cập: Bất kỳ ai**.
3. Bấm Triển khai và sao chép URL (dạng `https://script.google.com/macros/s/…/exec`).
4. Mở URL này bằng trình duyệt. Nếu thấy `{"ok":true,"app":"NS-NhanSu",…}` là đã xong.

> "Bất kỳ ai" chỉ có nghĩa là trang web gọi được API. Mọi thao tác vẫn phải đăng nhập bằng mã và PIN, và Google Sheet vẫn ở chế độ riêng tư.

### Bước 3 – GitHub Pages
1. Tạo repo trên GitHub, ví dụ `bao-cao-nhan-su-nghia-son`, rồi đưa toàn bộ thư mục này lên (bằng `git push` hoặc **Add file › Upload files**).
2. Sửa `js/config.js`: dán URL ở bước 2 vào `API_URL`. Có thể điền thêm `SHEET_URL` để Admin mở nhanh sheet.
3. Vào **Settings › Pages**, chọn **Source: Deploy from a branch**, **Branch: `main` / `(root)`**, rồi Save.
4. Sau 1–2 phút, trang chạy tại `https://<tài-khoản>.github.io/bao-cao-nhan-su-nghia-son/`.

> Với GitHub Free, Pages chỉ chạy được khi repo **công khai**. Với GitHub Pro/Team thì repo có thể để riêng tư, nhưng **trang web vẫn mở công khai**.
> Vì vậy code **không chứa bí mật nào**: PIN nằm trong Google Sheet (đã mã hóa) và dữ liệu chỉ được trả về sau khi đăng nhập.

### Bước 4 – Phân xưởng và giao PIN
- Cột **Xưởng** trong `DanhMuc` đã được nạp sẵn theo file Excel. Sửa **Họ tên** trong `NguoiDung` thành tên người nhập thật. Thêm hoặc bớt người dùng thì thêm dòng, rồi dùng menu *Cấp PIN mới* để tạo PIN.
- Gửi PIN **riêng cho từng người**, không gửi vào nhóm chung.
- Chọn **Nhân sự NS › Kiểm tra cấu hình** để xem bộ phận nào còn chưa gán nhóm hoặc chưa có người nhập.

---

## 4. Sử dụng hằng ngày

| Ai | Làm gì |
|---|---|
| Người nhập (theo xưởng) | Vào **Nhập liệu** và lọc theo xưởng nếu cần. Các ô đã có sẵn 0: chỉ sửa ô có phát sinh rồi bấm **Gửi số liệu**. Phím Enter / ↓ để xuống dòng. Dòng vàng là chưa gửi, viền đỏ là có lỗi, viền xanh là đã lưu. |
| Nhân sự / BGĐ | Xem **Dashboard** (tự làm mới mỗi 5 phút): tỷ lệ chuyên cần, theo đơn vị và xưởng, xu hướng 45 ngày, nghỉ phép CT/TV và tăng cường theo đơn vị, tăng ca (người, giờ), chọn xem Tất cả / NM1 / NM2 / Kho Thanh Bình, bộ phận thấp nhất, danh sách chưa nhập. Bấm **Sao chép bản tin** để gửi Zalo. |
| Báo cáo | **Báo cáo ngày** (theo mẫu file Excel: tổng hợp, chi tiết, biến động), **Tổng hợp tháng**, **Theo bộ phận (tháng)** (sắp xếp được), **Tình trạng nhập**. Có nút Xuất CSV và In. |
| Admin | **Quản trị › Nhập bù / sửa**: chọn ngày cũ, sửa, ghi lý do, lưu. Quân số các ngày sau được tính lại tự động. **Lịch sử chỉnh sửa** lưu toàn bộ thao tác. |

Danh mục, người dùng và cấu hình được sửa **trực tiếp trong Google Sheet**. Sheet `NhapLieu` có thể nối thẳng vào Power BI hoặc Looker Studio.

---

## 5. Cập nhật và bảo trì

- **Sửa Code.gs / Core.gs:** sau khi lưu, chọn **Triển khai › Quản lý bản triển khai › ✏ › Phiên bản: Phiên bản mới**. URL `/exec` giữ nguyên.
- **`apps-script/Core.gs` phải giống hệt `js/core.js`**, vì cùng một lõi tính toán chạy cả trên trình duyệt và Apps Script. File `ci/kiem-tra.yml` là GitHub Actions tự kiểm tra điều này và chạy test mỗi lần push. Khi đưa lên GitHub, chuyển file vào `.github/workflows/kiem-tra.yml`, hoặc tạo file đó trên web GitHub rồi dán nội dung vào.
- **Chạy test trên máy:** `node tests/core.test.js && node tests/gas.test.js` (cần Node 18 trở lên, không cần cài thêm gói).
  `node tests/server.js` chạy thử toàn bộ hệ thống tại `http://localhost:8766` với Apps Script giả lập.
- **Dữ liệu tăng dần:** mỗi năm khoảng 12.000 dòng (40 bộ phận × khoảng 300 ngày). Sau 2–3 năm nên chuyển các năm cũ sang sheet lưu trữ (ví dụ `NhapLieu_2026`) để API vẫn nhanh. Báo cáo chỉ đọc sheet `NhapLieu`.
- **CSV:** tỷ lệ % được xuất theo định dạng Việt Nam (95,3%). Nếu Excel hiển thị lệch cột thì mở bằng **Data › From Text/CSV**, chọn UTF-8 và dấu phẩy.

## 6. Cấu trúc thư mục
```
index.html              Trang duy nhất (SPA)
css/style.css           Giao diện
js/config.js            ← chỉ cần sửa API_URL
js/core.js              Lõi tính toán (= apps-script/Core.gs)
js/app.js               Giao diện: nhập liệu, dashboard, báo cáo, quản trị
js/api.js, js/demo.js   Kết nối API / backend demo
js/vendor/              Chart.js 4 (MIT), có sẵn trong repo, không phụ thuộc CDN
apps-script/            Code.gs, Core.gs, appsscript.json
tests/                  Test logic, giả lập Apps Script, máy chủ thử nghiệm
ci/kiem-tra.yml         GitHub Actions – chuyển vào .github/workflows/ khi đưa lên GitHub
```

## 7. Những điểm đã thay đổi so với file Excel
- Có thêm 2 cột nhân sự **mới** và **nghỉ việc** tách theo **chính thức / thời vụ**, để quân số cuốn chiếu đúng cho từng loại.
- Quân số không còn cố định theo danh mục. Quân số được chuyển tiếp mỗi ngày và lưu lại theo ngày.
- Cấu trúc v2 (11/2026): các loại vắng gộp thành **Nghỉ phép** tách chính thức / thời vụ; thêm **Tăng cường** (đi / đến) và **Số giờ tăng ca**. Sheet `NhapLieu` tự chuyển sang cấu trúc mới ở lần mở đầu tiên (hoặc menu **Nhân sự NS › Chuyển dữ liệu sang cấu trúc mới**): tổng vắng cũ được cộng vào Nghỉ phép chính thức, bản cũ sao lưu ở sheet `NhapLieu_cu`.
- Hàm MAXIFS không còn cần thiết, vì mọi phép tính chạy trên Apps Script và trình duyệt.
- Giữ nguyên tên bộ phận gốc, kể cả "NGUYÊN LIÊỤ", để khớp với các file khác. Theo file Excel mới, dòng BGĐ trong khối NM2 đã chuyển thành **NM2 - BGĐ**, thuộc NM2. Tổng quân số vẫn là 519 người: NM1 có 187 chính thức + 50 thời vụ, NM2 có 206 chính thức + 76 thời vụ.
