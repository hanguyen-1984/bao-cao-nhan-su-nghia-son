# BÀN GIAO DỰ ÁN – Hệ thống báo cáo nhân sự hằng ngày NM1/NM2 Đồ gỗ Nghĩa Sơn

Tình trạng tính đến ngày 18/11/2026. File này dùng để tiếp tục dự án trên máy khác hoặc với một tài khoản Claude khác.
Chi tiết kỹ thuật và hướng dẫn triển khai đầy đủ nằm trong `README.md`, cùng thư mục.

---

## 1. Mục tiêu
Thay file Excel `Mau_nhap_so_lieu_nhan_su_hang_ngay_NM1_NM2_2.xlsx` bằng một hệ thống gồm:
- **Form nhập liệu** theo nhóm (Văn phòng / Xưởng 1 / Xưởng 2 / Kho), chỉ cho **nhập đúng ngày hôm nay**, không nhập lùi và không nhập trước.
- **Báo cáo:** báo cáo ngày, tổng hợp tháng, theo bộ phận, tình trạng nhập, cùng bản tin Zalo.
- **Dashboard** để xem nhanh.
- **Dữ liệu** lưu trên **Google Sheet** (qua Google Apps Script). **Giao diện** chạy trên **GitHub Pages**.

## 2. Đã hoàn thành
- Code hoàn chỉnh, gồm giao diện web và Apps Script. Đã qua toàn bộ test: logic, giả lập Apps Script, tích hợp web với API, giao diện trên máy tính và điện thoại.
- Có **chế độ DEMO**: mở `index.html` là chạy được, không cần mạng. Đăng nhập bằng một trong 9 tài khoản (ADMIN, BGD, NM1-VP, NM1-X1, NM1-X2, NM1-KHO, NM2-VP, NM2-X1, NM2-X2), PIN demo là `123456`.

## 3. Các quyết định đã chốt (không cần hỏi lại)
| Nội dung | Quyết định |
|---|---|
| Người nhập | Một vài nhân viên nhập theo nhóm. Mỗi nhóm có 1 tài khoản: NM1-VP, NM1-X1, NM1-X2, NM1-KHO, NM2-VP, NM2-X1, NM2-X2. Thêm ADMIN (Phòng Nhân sự) và BGD (chỉ xem). |
| Phân nhóm bộ phận | Lấy theo cột Xưởng do người dùng điền trong file Excel: VP / X1 / X2 / KHO. Đã kiểm tra và **đồng ý**, kể cả hai điểm: NM1-X2 chỉ có TCVS, và TCBG/TCVS đảo nhóm giữa NM1 và NM2. |
| Dòng BGĐ khối NM2 | Đổi thành **NM2 - BGĐ**, thuộc NM2. NM1 có 187 chính thức + 50 thời vụ, NM2 có 206 chính thức + 76 thời vụ, tổng 519 người. |
| Thuật ngữ | **CT = Chính thức** (thay cho "Biên chế"). **TV = Thời vụ**. Trên giao diện ghi chữ đầy đủ. |
| Khóa ngày | Ngày lấy theo giờ máy chủ Google (múi giờ Việt Nam). Giờ chốt 23:59, được sửa trong ngày. Có thể đổi trong sheet `CauHinh`. |
| Ngày đã qua | Chỉ ADMIN được nhập bù, sửa hoặc xóa, bắt buộc ghi lý do và có lưu lịch sử (sheet `LichSu`). |
| Quân số | Tự cuốn chiếu theo ngày: đầu ngày + mới − nghỉ việc, tách chính thức và thời vụ, lưu lại theo từng ngày. |
| Kho Thanh Bình | Thuộc NM1 và có thêm một dòng riêng trong báo cáo. |
| Form nhập (19/11/2026) | Mọi ô mặc định 0, không bắt buộc nhập; gửi là ghi 0 cho bộ phận chưa đổi. |
| Trường dữ liệu v2 (19/11/2026) | **Nghỉ phép** CT/TV = tổng vắng (bỏ Phép năm, Không phép, Ốm, Thai sản, Việc riêng). **Tăng cường** đi/đến chỉ ghi nhận, không tính vào tỷ lệ; Thực tế làm việc = hiện diện − đi + đến. **Tăng ca** gồm số người và tổng số giờ của bộ phận (bước 0,5). Dữ liệu cũ: tổng vắng cộng vào Nghỉ phép CT, bản cũ lưu ở sheet `NhapLieu_cu`. |
| Dashboard (19/11/2026) | Bộ chọn Tất cả (mặc định) / Chỉ NM1 / Chỉ NM2 / Kho Thanh Bình. |
| Người dùng (19/11/2026) | Admin quản lý người dùng, phạm vi và đặt PIN trên web (Quản trị › Người dùng & PIN); mọi người tự đổi PIN. |
| Xem báo cáo (21/11/2026) | Dashboard và Báo cáo xem **công khai, không cần đăng nhập** (`XEM_CONG_KHAI = TRUE`). Nhập liệu và Quản trị vẫn đăng nhập bằng mã + PIN. |

## 4. Việc còn lại (đánh dấu bước đã làm)
Thứ tự làm, chi tiết xem `README.md` mục 3:

- [ ] **B1.** Tạo Google Sheet → Tiện ích mở rộng › Apps Script → đổi tên dự án thành "NS Nhân sự".
- [ ] **B2.** Dán `apps-script/Code.gs` vào tệp Code.gs.
- [ ] **B3.** Tạo tệp Script tên `Core`, dán `apps-script/Core.gs` vào → Ctrl+S.
- [ ] **B4.** Chọn hàm `setup` → Chạy → cấp quyền (Xem xét quyền → Nâng cao → Đi tới… → Cho phép).
- [ ] **B5.** Ghi lại **9 mã PIN** trong Nhật ký thực thi. Giữ kín, **không gửi cho Claude**.
- [ ] **B6.** Triển khai › Tùy chọn triển khai mới › Ứng dụng web. Thực thi với tư cách: Tôi. Người có quyền truy cập: Bất kỳ ai. Sau đó sao chép URL `/exec`.
- [ ] **B7.** Dán URL `/exec` vào `js/config.js` (dòng `API_URL`).
- [ ] **B8.** Tạo repo GitHub, đưa thư mục này lên, bật **Settings › Pages** (nhánh `main`, thư mục `/ (root)`). Chuyển `ci/kiem-tra.yml` vào `.github/workflows/`.
- [ ] **B9.** Chạy thử: đăng nhập NM1-X1, nhập một bộ phận, rồi xem Dashboard bằng tài khoản BGD.
- [ ] **B10.** Sửa họ tên người nhập thật trong sheet `NguoiDung`, rồi gửi PIN riêng cho từng người.

> Nếu tối 17/11 bạn đã dán code vào Apps Script: bản đó còn ghi "Biên chế" ở tên cột. Chức năng không khác gì, nhưng nên dán lại 2 file từ thư mục này cho đồng bộ.
> Nếu đã chạy `setup` rồi thì sửa tay tiêu đề cột trong sheet: `Biên chế gốc` → `Chính thức gốc`, và các cột "Biên chế…" trong `NhapLieu` thành "Chính thức…". Thứ tự cột giữ nguyên.

## 5. Chuyển sang máy Windows mới
1. Chép file zip bàn giao sang máy mới (USB, Google Drive, email…) rồi giải nén, ví dụ vào `D:\NGHIA SON\`.
2. Mở thử `he-thong-bao-cao-nhan-su\index.html` bằng Chrome để xem bản demo.
3. Trên máy mới, mở ứng dụng Claude (tài khoản mới), tạo cuộc trò chuyện hoặc Project mới, rồi **chọn thư mục đã giải nén** để Claude đọc được file.
4. Dán đoạn prompt ở mục 6, sửa lại bước bạn đang làm.

Tài khoản Claude mới **không thấy** lịch sử trò chuyện, Project hay bộ nhớ của tài khoản cũ. Mọi bối cảnh cần thiết đã nằm trong `BAN_GIAO.md` và `README.md`.

## 6. Prompt mẫu cho Claude trên máy mới
```
Mình đang tiếp tục dự án "Hệ thống báo cáo nhân sự hằng ngày NM1/NM2 Đồ gỗ Nghĩa Sơn".
Toàn bộ code nằm trong thư mục he-thong-bao-cao-nhan-su (đã hoàn chỉnh và đã test).
Hãy đọc BAN_GIAO.md và README.md trước. KHÔNG viết lại code, KHÔNG đổi các quyết định ở mục 3 của BAN_GIAO.md.
Mình đã làm xong đến bước B__ ở mục 4. Hãy hướng dẫn mình làm tiếp từ bước B__.
Lưu ý: apps-script/Core.gs phải luôn giống hệt js/core.js. Mình sẽ không gửi PIN.
```

## 7. Cấu trúc gói bàn giao
```
NGHIA SON\
├─ Mau_nhap_so_lieu_nhan_su_hang_ngay_NM1_NM2_2.xlsx   File Excel gốc (đã có cột Xưởng)
└─ he-thong-bao-cao-nhan-su\
   ├─ BAN_GIAO.md          ← file này
   ├─ README.md            Hướng dẫn kỹ thuật và triển khai đầy đủ
   ├─ index.html, css\, js\  Giao diện (GitHub Pages)
   ├─ apps-script\         Code.gs, Core.gs, appsscript.json (dán vào Apps Script)
   ├─ tests\               Test (cần Node 18 trở lên): node tests\core.test.js && node tests\gas.test.js
   └─ ci\kiem-tra.yml      GitHub Actions
```
