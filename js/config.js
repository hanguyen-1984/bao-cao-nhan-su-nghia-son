/**
 * CẤU HÌNH GIAO DIỆN – chỉ cần sửa file này sau khi triển khai Apps Script.
 * Không đặt mật khẩu/PIN hay bí mật nào ở đây: file này công khai trên GitHub Pages.
 */
window.NS_CONFIG = {
  // Dán URL Web App của Apps Script (kết thúc bằng /exec).
  // Để trống "" = chạy CHẾ ĐỘ DEMO với dữ liệu giả lập ngay trong trình duyệt.
  API_URL: 'https://script.google.com/macros/s/AKfycbzf3xjxfRILexGuYVHO57CErVHVqwDc4UYk312zUgteVxF9h5V8DZHP0VmDh3mUjrCaUg/exec',

  APP_NAME: 'Báo cáo nhân sự Nghĩa Sơn',
  SUB_NAME: 'NM1 – Công ty TNHH Đồ gỗ Nghĩa Sơn · NM2 – Công ty TNHH SXTM Đồ gỗ Nghĩa Sơn',

  // (Tuỳ chọn) Link Google Sheet để Admin mở nhanh từ trang Quản trị.
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1G5o2B1ivZ1yiML3keG99Fovi4y8G3gwmjiWujnqswoM/edit',

  // Dashboard tự làm mới sau bao nhiêu phút khi đang xem ngày hôm nay.
  AUTO_REFRESH_PHUT: 5
};
