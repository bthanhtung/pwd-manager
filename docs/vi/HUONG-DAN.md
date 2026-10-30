# Hướng dẫn OpenPass (Tiếng Việt)

OpenPass là trình quản lý mật khẩu mã nguồn mở. Mọi thứ được **mã hoá ngay trên máy bạn** trước khi gửi lên máy chủ,
nên kể cả người quản lý máy chủ cũng không đọc được mật khẩu của bạn.

## 1. Cài đặt

### Cách A — Thử trên máy tính của bạn (5 phút)

1. Cài **Docker Desktop**: <https://www.docker.com/products/docker-desktop/> rồi mở lên.
   Cài thêm **Git**: <https://git-scm.com/downloads> (Mac và Linux thường có sẵn).
2. Mở **Terminal** (macOS) hoặc **PowerShell** (Windows), dán lệnh:
   ```bash
   git clone https://github.com/bthanhtung/pwd-manager.git
   cd pwd-manager
   docker compose up -d --build
   ```
   Lần đầu build mất vài phút; những lần sau bật lên ngay.
3. Mở trình duyệt vào <http://localhost:8080> → bấm **Bắt đầu**.

Tắt: `docker compose stop` · Bật lại: `docker compose start`. Dữ liệu nằm trong volume `openpass-data`, không mất khi tắt.

### Cách B — Đưa lên mạng cho gia đình / công ty (15 phút)

Cần: một máy chủ Linux (VPS bất kỳ) và một tên miền.

1. Tạo bản ghi DNS loại `A`, ví dụ `pass.tencongty.com` → IP máy chủ.
2. Cài Docker trên máy chủ:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. Tải file triển khai và khai báo tên miền:
   ```bash
   git clone https://github.com/bthanhtung/pwd-manager.git && cd pwd-manager/deploy
   cp .env.example .env
   nano .env        # sửa DOMAIN=pass.tencongty.com
   ```
4. Build và chạy (chứng chỉ HTTPS được cấp tự động):
   ```bash
   docker compose up -d --build
   ```
5. Vào `https://pass.tencongty.com`, tạo tài khoản; đồng nghiệp tự tạo tài khoản của họ.
6. Khi mọi người đã vào đủ: sửa `SIGNUPS_ALLOWED=false` trong `.env` rồi chạy lại `docker compose up -d` để **đóng đăng ký**.

Cập nhật phiên bản mới: `git pull && docker compose up -d --build`.

## 2. Sử dụng

1. **Tạo kho** — chọn mật khẩu chính gồm 4–5 từ ngẫu nhiên. ⚠️ Quên là **không ai khôi phục được**.
2. **Nhập dữ liệu cũ** — *Nhập & xuất → Nhập*, thả file xuất từ Chrome, Safari, Bitwarden, 1Password, LastPass…
   Muốn thử trước? Dùng file dữ liệu giả [`docs/demo/demo-vault.json`](../demo/demo-vault.json).
   Nhập xong nhớ **xoá file xuất** trên máy vì nó chứa mật khẩu dạng chữ thường.
3. **Thêm mục** — bấm phím <kbd>N</kbd>. Bấm 🪄 để tạo mật khẩu mạnh. Dán khoá xác thực (TOTP) để xem mã 6 số ngay trong OpenPass.
4. **Chép nhanh** — bấm biểu tượng chép; bộ nhớ tạm tự xoá sau 30 giây.
   Phím tắt: <kbd>/</kbd> tìm · <kbd>G</kbd> tạo mật khẩu · <kbd>L</kbd> khoá.
5. **Chia sẻ trong nhóm** — *Nhóm → +*, đặt tên, rồi **Thêm thành viên** bằng email (người đó phải có tài khoản).
   So **dấu vân tay khoá** với đồng nghiệp (họ xem ở *Cài đặt → Tài khoản*) để chắc chắn đúng người.
6. **Kiểm tra sức khoẻ mật khẩu** — *Báo cáo bảo mật*: mật khẩu yếu, dùng lại, quá cũ; bấm **Chạy kiểm tra** để dò rò rỉ (riêng tư).
7. **Bảo vệ tài khoản** — *Cài đặt → Bảo mật*: bật đăng nhập hai bước, chọn thời gian tự khoá, xem thiết bị đang đăng nhập.
8. **Cài như ứng dụng** — Chrome/Edge: bấm biểu tượng cài trên thanh địa chỉ. iPhone: *Chia sẻ → Thêm vào MH chính*.
9. **Sao lưu** — *Nhập & xuất → Xuất → Bản sao lưu mã hoá*. Cất file và mật khẩu của nó ở nơi an toàn.

## 3. Câu hỏi thường gặp

- **Quên mật khẩu chính?** Không khôi phục được — đó là cái giá của mã hoá đầu-cuối. Hãy giữ bản sao lưu mã hoá.
- **Chủ máy chủ đọc được mật khẩu không?** Không. Máy chủ chỉ giữ dữ liệu đã mã hoá.
- **Có tốn phí không?** Không. Giấy phép MIT, dùng cho cá nhân, gia đình hay công ty đều được.
