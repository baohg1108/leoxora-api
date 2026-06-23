# LEOXORA-API — LỘ TRÌNH KỸ THUẬT 205 NGÀY

### (Bản Production-Grade — Bổ sung Testing Strategy + Checkpoint Hiểu Biết + Observability)

> **Ghi chú về bản này:** Nội dung kỹ thuật gốc của 205 ngày giữ nguyên 100%. Phần bổ sung gồm:
>
> 1. **Testing Strategy Master** (mục này) — coverage target cụ thể, phân loại Unit/Integration/E2E rõ ràng cho từng Phase, không còn mơ hồ "viết test đầy đủ".
> 2. **Explain-Back Checkpoint** cuối mỗi Phase — cơ chế tự kiểm tra hiểu biết thật, không chỉ "code chạy được".
> 3. **Observability tầng Business** — audit log cho hành động nhạy cảm, không chỉ bắt lỗi kỹ thuật.
>
> Các đoạn bổ sung được đánh dấu bằng `🆕`. Đoạn gốc giữ nguyên định dạng cũ.

---

## CÁCH ĐỌC FILE NÀY

Mỗi ngày làm việc 8h thực tế nên chia theo nhịp: **2h đọc hiểu + setup → 4h code → 1h viết test → 1h tự review/ghi chú.** Đừng dồn hết 8h vào code rồi để test "qua bữa khác" — quy tắc _"Test đi kèm Logic phức tạp"_ ở plan gốc là bắt buộc, không phải gợi ý.

---

# 🆕 TESTING STRATEGY MASTER — KIM CHỈ NAM XUYÊN SUỐT 205 NGÀY

Đây là phần quan trọng nhất bị thiếu ở bản plan gốc. Một dự án claim "vượt 95% intern" mà testing chỉ nói chung "viết unit test phủ 80%" thì **sẽ bị một Senior thật loại ngay khi review code**, vì testing là nơi phân biệt rõ nhất giữa người _biết code chạy_ và người _biết code đúng dưới mọi điều kiện_.

## 1. Nguyên tắc phân loại 3 tầng Test (Test Pyramid áp dụng cho dự án này)

```
                    ▲
                   / \
                  /E2E\          ← Ít nhất, chậm nhất, đắt nhất
                 /-----\            (5-10% tổng số test)
                /  INT  \        ← Vừa, test luồng nghiệp vụ thật + DB thật
               /---------\          (20-30% tổng số test)
              /   UNIT    \     ← Nhiều nhất, nhanh nhất, rẻ nhất
             /-------------\        (60-70% tổng số test)
```

**Quy tắc bắt buộc khi viết test cho dự án này:**

| Loại Test            | Khi nào dùng                                                                                             | Mock gì                                                                                      | Không mock gì                                | Tốc độ chạy mong đợi           |
| -------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------ |
| **Unit Test**        | Logic thuần túy: thuật toán tính toán (SM2, Streak, tỷ lệ %), validation logic, pure function            | Toàn bộ DB, Redis, HTTP call ra ngoài (VNPay, Mailtrap, Cloudinary)                          | Logic nội bộ của class đang test             | < 50ms / test, cả suite < 10s  |
| **Integration Test** | Luồng nghiệp vụ chạm tới DB thật (qua Testcontainers hoặc DB test riêng), Repository, TypeORM query thật | Các service bên thứ 3 (VNPay, Mailtrap, Cloudinary) — dùng HTTP mock (nock) hoặc test double | TypeORM, PostgreSQL, Redis thật              | < 2s / test, cả suite < 2 phút |
| **E2E Test**         | Toàn bộ luồng từ HTTP request → response, qua tất cả Guard/Pipe/Interceptor thật                         | Chỉ mock 3rd-party API bên ngoài (VNPay sandbox call thật nếu có thể, nếu không thì mock)    | Toàn bộ pipeline NestJS, DB thật, Redis thật | < 5s / test, cả suite < 5 phút |

**Tại sao phân tầng này quan trọng — góc nhìn System:**
Nếu intern viết 200 Unit Test nhưng toàn bộ đều mock Repository (`jest.fn()` trả về dữ liệu giả định sẵn), con số coverage 80% đó là **coverage giả** — nó chứng minh code _chạy không lỗi cú pháp_, không chứng minh _logic nghiệp vụ đúng khi chạm DB thật_. Ví dụ kinh điển: Unit Test cho `assertOwnership()` mock sẵn `findOne()` trả về đúng record — test pass 100% dù hàm có viết sai điều kiện `WHERE` trong query thật. Đây là lý do **Integration Test với DB thật là bắt buộc**, không phải optional.

## 2. Coverage Target cụ thể theo từng Phase (thay thế con số "80%" mơ hồ ở bản gốc)

| Phase                     | Unit Coverage Target                                                       | Integration Test bắt buộc cho                                                                                         | E2E Test bắt buộc cho                                                                            |
| ------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Phase 1 (Auth)            | ≥ 85% cho `auth.service.ts`, `refresh-token.service.ts`                    | Register → Login → Refresh → Logout (full cycle với Redis thật)                                                       | `POST /auth/register` → `POST /auth/login` → `GET /users/me` (test qua Guard thật)               |
| Phase 2 (Marketplace)     | ≥ 80% cho `courses.service.ts`, `lessons.service.ts`, `reviews.service.ts` | BOLA test (2 user thật, DB thật), Reorder transaction, Rating AVG SQL                                                 | Luồng Teacher tạo course → submit → Admin approve → Student xem                                  |
| Phase 3 (Payment)         | ≥ 90% cho `payments.service.ts` (đây là phần rủi ro tài chính cao nhất)    | **Bắt buộc**: giả lập 5 IPN request đồng thời (dùng `Promise.all`) vào DB test thật, assert chỉ 1 Enrollment được tạo | Toàn bộ luồng initiate → simulate IPN callback → check enrollment + coupon                       |
| Phase 4 (Learning Engine) | ≥ 85% cho `streak.service.ts` (timezone), `sm2.service.ts`                 | Zero-division với course rỗng (DB thật), Notification qua EventEmitter thật (không mock event)                        | Complete lesson → progress update → streak update → notification fired                           |
| Phase 5 (DevOps)          | Không áp dụng coverage %                                                   | CI pipeline tự chạy toàn bộ test suite trên DB/Redis container thật                                                   | Smoke test sau khi deploy: gọi `/health`, `/auth/login`, `/courses` trên môi trường staging thật |

## 3. 🆕 Quy tắc viết test theo từng dạng logic (Checklist áp dụng xuyên suốt)

**Với mọi đoạn logic tính toán số học (Streak, SM2, % tiến độ, Rating):**

- [ ] Test case "happy path" (input chuẩn, ra kết quả đúng)
- [ ] Test case **boundary** (giá trị biên: 0, âm, max, vừa qua ngưỡng)
- [ ] Test case **edge case gây sập hệ thống** nếu không xử lý (chia cho 0, mảng rỗng, null)
- [ ] Test case **time-dependent** nếu có (dùng `jest.useFakeTimers()` để giả lập thời gian, không phụ thuộc giờ chạy test thật)

**Với mọi API có phân quyền (Guard, Ownership check):**

- [ ] Test "đúng quyền → cho qua" (200/201)
- [ ] Test "không có token → chặn" (401)
- [ ] Test "có token nhưng sai role → chặn" (403)
- [ ] Test "đúng role nhưng không phải owner → chặn, trả 404 không phải 403" (đúng theo yêu cầu che giấu BOLA ở plan gốc)

**Với mọi đoạn logic có Race Condition (Refresh Token Rotation, IPN, Coupon usedCount, Review rating update):**

- [ ] Test chạy tuần tự đúng luồng (happy path)
- [ ] Test **chạy đồng thời** bằng `Promise.all([...])` giả lập N request cùng lúc, assert kết quả cuối cùng đúng (không nhân bản, không vượt giới hạn)
- [ ] Đây là loại test **dễ bị bỏ qua nhất** vì khó viết — nhưng chính là loại chứng minh hiểu sâu nhất về concurrency, không phải optional

**Với mọi API trả dữ liệu nhạy cảm (password, correctAnswer, contentUrl chưa mua):**

- [ ] Test response **không chứa** field nhạy cảm trong mọi trường hợp (kể cả khi field đó tồn tại trong DB)

## 4. 🆕 Công cụ cụ thể cần cài đặt cho Testing (bổ sung vào Day 1, không đợi tới buffer phase)

```bash
npm install -D @nestjs/testing jest ts-jest supertest @types/supertest
npm install -D @testcontainers/postgresql @testcontainers/redis  # Integration test với container thật, không cần DB dev
npm install -D nock  # Mock HTTP call ra ngoài (VNPay, Mailtrap) ở tầng network, không mock code
```

**Vì sao dùng Testcontainers thay vì mock TypeORM Repository hoàn toàn:** Testcontainers tự động spawn một container PostgreSQL/Redis thật (riêng biệt với DB dev) chỉ tồn tại trong lúc chạy test rồi tự xóa. Điều này đảm bảo Integration Test chạy trên **constraint thật của DB** (unique constraint, foreign key, cascade delete) — những thứ mock không bao giờ bắt được lỗi.

## 5. 🆕 Cấu trúc thư mục test chuẩn cho dự án

```
src/modules/payments/
├── payments.service.ts
├── payments.service.spec.ts          ← Unit test (mock toàn bộ DB/Redis)
└── tests/
    ├── payments.integration.spec.ts  ← Integration test (Testcontainers, DB thật)
    └── payments.e2e-spec.ts          ← E2E test (toàn bộ HTTP pipeline)
```

---

---

# PHASE 1: FOUNDATION, SECURE AUTHENTICATION & CORE USER (Day 1–35)

## Day 1 — Khởi tạo Project & Môi trường Docker hóa

**Mục tiêu ngày:** Docker compose khởi chạy thành công PostgreSQL 16 và Redis 7; ứng dụng NestJS start ở chế độ Strict TypeScript không lỗi.

**Việc cần làm:**

- Khởi chạy dự án: `nest new leoxora-api --package-manager npm`. Chọn cấu hình TypeScript strict.
- Dọn dẹp các file boilerplate chưa sử dụng: Xóa `app.controller.spec.ts`, `app.service.ts`, `app.controller.ts`.
- Tạo file `docker-compose.yml` định nghĩa service `postgres` (port 5433 để tránh xung đột) và `redis` (port 6380 kèm password).
- Tạo file `.env` và `.env.example` chứa toàn bộ biến môi trường của hệ thống.
- Cài đặt: `npm install zod @nestjs/config`.
- Viết schema kiểm thử biến môi trường bằng Zod trong `src/config/env.validation.ts`.
- Cấu hình `ConfigModule` trong `src/app.module.ts` để load và validate cấu hình ngay khi bootstrap.
- 🆕 Cài đặt bộ công cụ testing ngay từ Day 1 (xem Testing Strategy Master, mục 4): `npm install -D @nestjs/testing jest ts-jest supertest @types/supertest @testcontainers/postgresql @testcontainers/redis nock`.
- 🆕 Tạo file `docker-compose.test.yml` riêng cho môi trường test (port khác hẳn dev, ví dụ 5434/6381) để Integration Test không bao giờ đụng vào DB dev đang chứa dữ liệu thật của bạn.

**Files tạo ra / sửa:** `docker-compose.yml`, `docker-compose.test.yml` 🆕, `.env`, `.env.example`, `.gitignore`, `src/config/env.validation.ts`, `src/app.module.ts`

**Bug hay gặp & Góc nhìn System:**

- Bug: Lỗi cổng bị chiếm (`Port 5432 already in use`). Xử lý bằng cách đổi port mapping bên ngoài thành `5433:5432`.
- System Look: Zod validation giúp fail-fast. Nếu thiếu biến môi trường quan trọng (như `JWT_SECRET`), hệ thống crash ngay khi start thay vì lỗi ngầm lúc chạy tính năng.
- 🆕 System Look: Tách `docker-compose.test.yml` ngay từ đầu tránh một lỗi rất phổ biến ở tháng 2-3 của dự án: chạy Integration Test vô tình `TRUNCATE` mất dữ liệu dev đang dùng để demo.

**Commit message mẫu:** `chore: init nestjs project with docker compose and env validation`

**Done criteria:**

- [ ] `docker compose up -d` chạy mượt mà, container không bị restart.
- [ ] `npm run start:dev` biên dịch thành công không cảnh báo TypeScript.
- [ ] Kiểm tra port bằng `nc -z localhost 5433` và `nc -z localhost 6380` thành công.
- [ ] 🆕 `docker compose -f docker-compose.test.yml up -d` chạy độc lập, không xung đột port với compose dev.

---

## Day 2 — Cấu hình TypeORM & Quản lý Migration CLI nghiêm ngặt

**Mục tiêu ngày:** Kết nối NestJS với PostgreSQL qua TypeORM; thiết lập Migration CLI độc lập, không dùng `synchronize: true`.

**Việc cần làm:**

- Cài đặt: `npm install @nestjs/typeorm typeorm pg`. Dev: `npm install ts-node tsconfig-paths -D`.
- Tạo cấu hình kết nối ứng dụng trong `src/config/database.config.ts`.
- Tạo file cấu hình riêng cho TypeORM CLI: `src/config/typeorm-cli.config.ts`, xuất ra một `DataSource` thực tế.
- Thêm scripts quản lý migration vào `package.json`.
- Chạy thử tạo file migration đầu tiên bằng CLI.

**Files tạo ra / sửa:** `src/config/database.config.ts`, `src/config/typeorm-cli.config.ts`, `src/app.module.ts`, `package.json`

**Bug hay gặp & Góc nhìn System:**

- Bug: TypeORM CLI không đọc được alias đường dẫn trong `tsconfig.json`. Khắc phục: truyền `-r tsconfig-paths/register` vào lệnh `ts-node`.
- Quy tắc vàng: `synchronize: false` cho toàn bộ môi trường. Dùng `synchronize: true` ở dev dễ tạo thói quen cẩu thả, nguy cơ mất sạch dữ liệu khi vô tình kích hoạt trên production.

**Commit message mẫu:** `feat(db): setup typeorm with postgresql and migration cli`

**Done criteria:**

- [ ] `npm run migration:generate -- src/migrations/Init` tạo ra file migration hợp lệ.
- [ ] Kết nối database thành công bằng DBeaver qua port 5433.

---

## Day 3 — Thiết kế User Entity & Khởi chạy File Migration Đầu tiên

**Mục tiêu ngày:** Bảng `users` được khởi tạo thành công trong PostgreSQL với index, audit fields, enum phân quyền.

**Việc cần làm:**

- Tạo enum `UserRole` gồm: `student`, `teacher`, `admin`.
- Xây dựng lớp `User` trong `src/modules/users/entities/user.entity.ts`.
- Dùng `@Exclude()` của `class-transformer` trên trường mật khẩu hash để ngăn rò rỉ dữ liệu.
- Tạo file migration dựa trên entity vừa khai báo, chạy lệnh apply.

**Files tạo ra / sửa:** `src/common/enums/user-role.enum.ts`, `src/modules/users/entities/user.entity.ts`, `src/migrations/[Timestamp]-CreateUsersTable.ts`

**Bug hay gặp & Góc nhìn System:**

- Bug: Thay đổi cấu trúc enum trong code, TypeORM không tự sinh mã `ALTER TYPE` trong Postgres — phải viết SQL thủ công trong migration.
- System Look: Thêm `@Index({ unique: true })` trên cột `email` để tối ưu tốc độ truy vấn đăng nhập và đảm bảo tính duy nhất ở tầng database, tránh race condition trùng email.

**Commit message mẫu:** `feat(users): add user entity with role enum and soft delete`

**Done criteria:**

- [ ] `npm run migration:run` thành công, không lỗi cú pháp SQL.
- [ ] Kiểm tra cấu trúc bảng `users` trong DBeaver, cột `role` dùng kiểu enum của Postgres.

---

## Day 4 — Xây dựng Module Users & Đăng ký Interceptor Toàn cục

**Mục tiêu ngày:** Hoàn thành API lấy thông tin chi tiết và xóa mềm người dùng; áp dụng cơ chế tự động lọc trường nhạy cảm trong response.

**Việc cần làm:**

- Tạo module qua CLI: `nest generate module modules/users --no-spec`, tương tự service/controller.
- Viết `findOne` và `remove` (soft delete qua `deletedAt`).
- Xây dựng `UpdateUserDto` tích hợp `class-validator`.
- Khai báo `ValidationPipe` toàn cục cùng `ClassSerializerInterceptor` trong `src/main.ts`.
- 🆕 Viết Unit Test đầu tiên của dự án: `users.service.spec.ts` — mock Repository, test `findOne` trả về user không chứa `passwordHash` sau khi qua serializer.

**Files tạo ra / sửa:** `src/modules/users/users.module.ts`, `src/modules/users/users.service.ts`, `src/modules/users/users.controller.ts`, `src/modules/users/dto/update-user.dto.ts`, `src/main.ts`, 🆕 `src/modules/users/users.service.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- Bug: Khai báo `@Exclude()` trong entity nhưng response vẫn chứa password hash — do thiếu khởi tạo `ClassSerializerInterceptor` với `Reflector` tại `main.ts`.
- System Look: Cấu hình `whitelist: true` và `forbidNonWhitelisted: true` trong `ValidationPipe` để tự động từ chối (400) các tham số lạ ngoài DTO, ngăn Mass Assignment attack.

**Commit message mẫu:** `feat(users): implement user module with basic CRUD`

**Done criteria:**

- [ ] `GET /users/:id` không chứa trường `passwordHash`.
- [ ] `DELETE /users/:id` cập nhật `deleted_at` chính xác, không mất bản ghi.
- [ ] 🆕 `npm run test -- users.service.spec.ts` pass 100%.

---

## Day 5 — Triển khai Đăng ký & Cơ chế Hash Mật khẩu An toàn

**Mục tiêu ngày:** `POST /auth/register` hoạt động chuẩn xác, mật khẩu mã hóa bằng Bcrypt salt rounds cao, chống email trùng lặp an toàn (race-condition-safe).

**Việc cần làm:**

- Cài đặt: `npm install bcrypt`, dev: `npm install -D @types/bcrypt`.
- Tạo `auth` module, service, controller.
- `RegisterDto` ràng buộc password phải có hoa/số/ký tự đặc biệt bằng Regex.
- Viết `register()`: check email trùng, hash password (`bcrypt.hash`, salt rounds = 12), lưu trữ.
- 🆕 Viết Unit Test `auth.service.spec.ts` cho `register()`: mock Repository, test case email hợp lệ → gọi `bcrypt.hash` đúng 1 lần với rounds=12; test case email trùng → throw `ConflictException`.
- 🆕 Viết Integration Test đầu tiên (`tests/auth.integration.spec.ts`, dùng Testcontainers PostgreSQL thật): đăng ký 2 user với email giống nhau **đồng thời** bằng `Promise.allSettled`, assert chỉ 1 thành công, 1 nhận lỗi 409 — đây chính là test cho race condition được cảnh báo ở "Bug hay gặp" bên dưới.

**Files tạo ra / sửa:** `src/modules/auth/auth.module.ts`, `src/modules/auth/auth.service.ts`, `src/modules/auth/auth.controller.ts`, `src/modules/auth/dto/register.dto.ts`, 🆕 `src/modules/auth/auth.service.spec.ts`, 🆕 `src/modules/auth/tests/auth.integration.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- Bug: Quên `await` trước `bcrypt.hash`. Hàm này async, nếu không đợi, đối tượng lưu vào DB sẽ là Promise lỗi.
- System Look: Kiểm tra email trùng bằng 2 bước (query rồi insert) có thể bị race condition nếu 2 request cùng email gửi cùng mili-giây. Giải pháp triệt để: bọc try/catch, bắt mã lỗi `23505` (Unique Violation) từ PostgreSQL, trả `ConflictException` (409).

**Commit message mẫu:** `feat(auth): implement user registration with bcrypt password hashing`

**Done criteria:**

- [ ] Đăng ký hợp lệ → HTTP 201.
- [ ] Đăng ký email đã tồn tại → HTTP 409.
- [ ] 🆕 Integration Test race condition pass: gửi đồng thời 2 request register cùng email, đúng 1 row được tạo trong DB thật.

---

## Day 6 — Đăng nhập & Tạo JWT Access Token Stateless

**Mục tiêu ngày:** `POST /auth/login` kiểm tra định danh chính xác, ký JWT Access Token chứa thông tin cơ bản, hết hạn 15 phút.

**Việc cần làm:**

- Cài đặt: `npm install @nestjs/jwt @nestjs/passport passport passport-jwt`, dev: `@types/passport-jwt`.
- Import `JwtModule` vào `AuthModule`, truyền secret từ config.
- Xây dựng `LoginDto`.
- Viết `login()`: đối chiếu `bcrypt.compare`, nếu khớp ký payload gồm `sub`, `email`, `role`.
- 🆕 Unit Test: test case sai password → `UnauthorizedException`; test case đúng → trả về object chứa `accessToken` là string hợp lệ (decode thử bằng `jwt.decode`, không cần verify signature trong unit test).

**Files tạo ra / sửa:** `src/modules/auth/dto/login.dto.ts`, `src/modules/auth/auth.service.ts`, `src/modules/auth/auth.module.ts`, 🆕 cập nhật `auth.service.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- Bảo mật (User Enumeration Attack): Tuyệt đối không viết thông báo chi tiết "Không tìm thấy email" hay "Sai mật khẩu" riêng biệt — kẻ tấn công dò quét email tồn tại. Luôn trả về **một** thông báo chung: "Email hoặc mật khẩu không chính xác" kèm 401.

**Commit message mẫu:** `feat(auth): implement login with jwt access token`

**Done criteria:**

- [ ] Đăng nhập thành công trả về `accessToken`.
- [ ] Dùng jwt.io kiểm tra payload và `exp` đúng.
- [ ] 🆕 Unit Test pass: cả 2 message lỗi (sai email, sai password) đều giống nhau ở tầng response.

---

## Day 7 — Refresh Token Rotation (RTR) với Redis

**Mục tiêu ngày:** Cấu hình Redis qua `ioredis`. Cấp song song access/refresh token khi login. Triển khai xoay vòng một lần sử dụng (RTR) chống chiếm đoạt token.

**Việc cần làm:**

- Cài đặt: `npm install ioredis`, dev: `@types/ioredis`.
- Tạo `RedisModule`, `RedisService` quản lý vòng đời kết nối.
- Tạo `RefreshTokenService`: lưu hash refresh token lên Redis dạng key `rt:{userId}:{tokenId}` kèm TTL, verify, rotate.
- API `POST /auth/refresh`.
- 🆕 Integration Test (Testcontainers Redis + Postgres thật): test rotate thành công sinh token mới; test gửi lại refresh token cũ **2 lần liên tiếp** → lần 2 phải bị 401 và toàn bộ key `rt:{userId}:*` trong Redis bị xóa sạch (verify bằng cách query trực tiếp Redis client trong test, không qua API).
- 🆕 Integration Test concurrency: dùng `Promise.all` gửi đồng thời 3 request refresh cùng 1 refresh token hợp lệ — đúng 1 request thành công, 2 request còn lại phải fail (đây là test mô phỏng tình huống thật: nhiều tab/device cùng refresh).

**Files tạo ra / sửa:** `src/modules/redis/redis.module.ts`, `src/modules/redis/redis.service.ts`, `src/modules/auth/refresh-token.service.ts`, `src/modules/auth/auth.controller.ts`, 🆕 `src/modules/auth/tests/refresh-token.integration.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- RTR ngăn tấn công: Khi client gửi refresh token cũ đã dùng, hệ thống không tìm thấy key trên Redis (đã xóa ở lần rotate trước). Phải kích hoạt phòng vệ khẩn cấp: quét toàn bộ key `rt:{userId}:*` và xóa sạch, ép toàn bộ thiết bị đăng nhập lại (revoke all sessions).

**Commit message mẫu:** `feat(auth): implement refresh token rotation with redis`

**Done criteria:**

- [ ] Refresh hợp lệ → nhận cặp token mới.
- [ ] Gửi lại refresh token cũ lần 2 → 401, toàn bộ token khác của user bị xóa.
- [ ] 🆕 Test concurrency 3 request đồng thời pass đúng kỳ vọng (1 thành công, 2 fail).

---

## Day 8 — Passport JWT Strategy & RBAC Guard

**Mục tiêu ngày:** Bảo vệ toàn bộ API bằng Guard kiểm tra token toàn cục; decorator bóc tách user; phân quyền chi tiết theo role.

**Việc cần làm:**

- `JwtStrategy` kế thừa `passport-jwt`.
- `JwtAuthGuard` kế thừa `AuthGuard('jwt')`, đăng ký Global Guard.
- Decorator `@Public()` cho API công khai.
- Decorator `@CurrentUser()` lấy thông tin user từ Request.
- `RolesGuard` đối chiếu `role` với `@Roles()` yêu cầu.
- 🆕 E2E Test đầu tiên của dự án (`tests/auth.e2e-spec.ts`, dùng `supertest` qua toàn bộ pipeline NestJS thật, không mock Guard): gọi API không có `@Public()` mà không có token → 401; gọi API có `@Roles(ADMIN)` bằng token student → 403.

**Files tạo ra / sửa:** `src/modules/auth/strategies/jwt.strategy.ts`, `src/common/guards/jwt-auth.guard.ts`, `src/common/guards/roles.guard.ts`, `src/common/decorators/public.decorator.ts`, `src/common/decorators/roles.decorator.ts`, `src/common/decorators/current-user.decorator.ts`, `src/app.module.ts`, 🆕 `test/auth.e2e-spec.ts`

**Bug hay gặp & Góc nhìn System:**

- Tối ưu hóa khủng khiếp: Trong `validate()` của `JwtStrategy`, **tuyệt đối không** gọi `usersService.findById(payload.sub)` vì Guard chạy trên MỌI request, gây bottleneck DB. Tin tưởng payload đã decode, trả thẳng thông tin cơ bản.

**Commit message mẫu:** `feat(auth): implement jwt strategy and rbac guards`

**Done criteria:**

- [ ] API không `@Public()`, không token → 401.
- [ ] `@Roles(ADMIN)`, gọi bằng student → 403.
- [ ] 🆕 E2E test pass qua toàn bộ pipeline thật (không mock Guard).

---

## Day 9–10 — Mailtrap Email Xác thực & Quản lý Mã OTP

**Mục tiêu ngày:** Hoàn thành luồng đăng ký cần xác thực OTP qua email. Hệ thống gửi link lấy lại mật khẩu an toàn.

**Việc cần làm:**

- Đăng ký Mailtrap.io lấy SMTP giả lập.
- Cài đặt: `npm install nodemailer`, dev: `@types/nodemailer`.
- `MailModule`, `MailService`.
- Sinh OTP 6 số, lưu hash OTP lên Redis TTL 10 phút, khóa `otp:{email}`.
- API `POST /auth/verify-email`.
- API `POST /auth/forgot-password` (JWT ngắn hạn 15 phút) và `POST /auth/reset-password`.
- 🆕 Unit Test cho `MailService`: dùng `nock` để mock SMTP transport (không gửi mail thật trong test), assert đúng nội dung/định dạng OTP được generate đúng 6 chữ số.
- 🆕 Integration Test: verify OTP đúng → `isVerified = true` trong DB thật; verify OTP sai 1 lần → vẫn còn 1 lần thử (nếu có rate limit OTP, xem Day 11); verify OTP sau khi TTL hết hạn (giả lập bằng cách set TTL ngắn 1s trong test) → thất bại đúng cách.

**Files tạo ra / sửa:** `src/modules/mail/mail.module.ts`, `src/modules/mail/mail.service.ts`, `src/modules/auth/dto/verify-email.dto.ts`, `src/modules/auth/dto/forgot-password.dto.ts`, `src/modules/auth/auth.service.ts`, 🆕 `src/modules/mail/mail.service.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- Bug: Cổng SMTP mặc định 587 có thể bị chặn ở một số môi trường mạng. Ưu tiên cổng thay thế 2525 của Mailtrap.

**Commit message mẫu:** `feat(auth): implement email verification and forgot password flow`

**Done criteria:**

- [ ] Đăng ký mới → email chứa OTP xuất hiện trên Mailtrap.
- [ ] OTP đúng → `isVerified = true`.
- [ ] 🆕 Test TTL hết hạn pass đúng kỳ vọng.

---

## Day 11 — Rate Limiting, Helmet, Exception Filter Toàn cục

**Mục tiêu ngày:** Chống DDoS bằng Rate Limiting, Helmet headers, cấu trúc lỗi đầu ra đồng nhất.

**Việc cần làm:**

- Cài đặt: `npm install @nestjs/throttler helmet`.
- `ThrottlerModule` mặc định 10 req/phút/IP.
- `@Throttle()` siết riêng: Login 5 lần/phút, Register 3 lần/phút.
- `app.use(helmet())` trong `main.ts`.
- `HttpExceptionFilter` kế thừa `ExceptionFilter`.
- 🆕 E2E Test: gửi 6 request login liên tiếp trong < 1 phút → request thứ 6 trả 429. Kiểm tra response header có `X-Content-Type-Options: nosniff`.
- 🆕 Unit Test cho `HttpExceptionFilter`: test format response đúng `{ statusCode, message, timestamp, path }` cho cả lỗi 400 và 404.

**Files tạo ra / sửa:** `src/app.module.ts`, `src/main.ts`, `src/common/filters/http-exception.filter.ts`, 🆕 `src/common/filters/http-exception.filter.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- System Look: Tránh `@Catch()` chung chung che giấu lỗi nghiêm trọng. Bắt riêng `HttpException` để chuẩn hóa response cho Frontend; lỗi 500 không kiểm soát để NestJS log nguyên bản ra console.

**Commit message mẫu:** `feat(security): add rate limiting, helmet headers, exception filter`

**Done criteria:**

- [ ] 6 request login/phút → request 6 trả 429.
- [ ] Header response có `X-Content-Type-Options`, `X-Frame-Options`.
- [ ] 🆕 Unit test filter pass cho cả 400 và 404.

---

## Day 12–13 — Cloudinary & API Tải Ảnh Đại diện

**Mục tiêu ngày:** Upload ảnh từ Buffer RAM lên Cloudinary; tự động xóa ảnh cũ khi đổi avatar mới.

**Việc cần làm:**

- Đăng ký Cloudinary lấy Cloud Name, API Key, Secret.
- Cài đặt: `npm install cloudinary multer`, dev: `@types/multer`.
- `CloudinaryModule`, `CloudinaryService`.
- `uploadStream` chuyển Buffer sang Cloudinary, auto-crop 400x400px.
- API `POST /users/me/avatar` dùng `FileInterceptor('avatar')`.
- 🆕 Unit Test cho `CloudinaryService`: mock Cloudinary SDK (không gọi API thật trong unit test), test `fileFilter` reject file không phải `image/*`, test reject file > 5MB.
- 🆕 Integration Test (có thể dùng Cloudinary sandbox thật hoặc mock qua `nock` nếu không muốn tốn quota): upload ảnh mới → ảnh cũ trên Cloudinary bị xóa, verify bằng cách check Cloudinary API trả 404 cho `public_id` cũ.

**Files tạo ra / sửa:** `src/modules/cloudinary/cloudinary.provider.ts`, `src/modules/cloudinary/cloudinary.module.ts`, `src/modules/cloudinary/cloudinary.service.ts`, `src/modules/users/users.controller.ts`, 🆕 `src/modules/cloudinary/cloudinary.service.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- Bug: Quá tải RAM hoặc lỗ hổng bảo mật khi cho upload file lớn/mã độc giả ảnh. Giới hạn Multer 5MB (`fileSize: 5 * 1024 * 1024`), `fileFilter` kiểm tra `mimetype.startsWith('image/')`.

**Commit message mẫu:** `feat(users): add profile update and cloudinary avatar upload`

**Done criteria:**

- [ ] Upload ảnh → nhận URL Cloudinary.
- [ ] Upload ảnh lần 2 → ảnh cũ bị xóa khỏi Media Library.
- [ ] 🆕 Unit test reject file sai định dạng/quá kích thước pass.

---

## Day 14–16 — Placement Test Module & Thuật toán Phân bậc Tự động

**Mục tiêu ngày:** Cấu trúc DB lưu câu hỏi kiểm tra phân bậc A1-C1; thuật toán tự động chấm điểm và gán `userLevel`.

**Việc cần làm:**

- Entity `PlacementQuestion` (JSONB cho options, index đáp án đúng) và `PlacementAttempt`.
- Seeder script 30 câu hỏi đa cấp bậc.
- API `GET /placement-test` lấy random 20 câu.
- API `POST /placement-test/submit` chấm điểm, cập nhật `userLevel`.
- 🆕 Unit Test cho thuật toán chấm điểm: test case 16/20 đúng (80%) → gán B2; test case các mốc % khác (boundary test: đúng tại ngưỡng chuyển bậc, ví dụ 79% vs 80%) — đây là loại test bắt buộc theo Testing Strategy Master mục 3 (boundary test cho mọi logic số học).
- 🆕 Integration Test: gọi `GET /placement-test` → response không chứa field `correctAnswer` ở bất kỳ câu hỏi nào (test bằng cách serialize response và search string `correctAnswer` không xuất hiện).

**Files tạo ra / sửa:** `src/modules/placement/entities/placement-question.entity.ts`, `src/modules/placement/entities/placement-attempt.entity.ts`, `src/modules/placement/dto/submit-test.dto.ts`, `src/modules/placement/placement.service.ts`, `src/modules/placement/placement.controller.ts`, 🆕 `src/modules/placement/placement.service.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- Bảo mật: Khi trả danh sách câu hỏi, **bắt buộc** map loại bỏ `correctAnswer` khỏi response. Không lọc bỏ → F12 Inspect Element xem được toàn bộ đáp án.

**Commit message mẫu:** `feat(placement): add placement test module with auto level assignment`

**Done criteria:**

- [ ] API đề thi không rò rỉ `correctAnswer`.
- [ ] Đúng 16/20 → `userLevel` = B2.
- [ ] 🆕 Boundary test các mốc % chuyển bậc pass chính xác.

---

## Day 17–20 — Swagger OpenAPI & Tổng duyệt Đóng gói Phase 1

**Mục tiêu ngày:** Cấu hình Swagger UI toàn diện cho Phase 1; tự kiểm tra chất lượng theo checklist; Git Tag đầu tiên.

**Việc cần làm:**

- Cài đặt: `npm install @nestjs/swagger`.
- `DocumentBuilder` tích hợp Bearer Token trong `main.ts`.
- `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()`, `@ApiProperty()` vào toàn bộ Controller/DTO.
- Chạy rà soát toàn bộ tiêu chí Phase 1.
- 🆕 Chạy full test suite (Unit + Integration + E2E) đã viết từ Day 1-16, đảm bảo **toàn bộ pass** trước khi tag version — không tag version khi còn test fail hoặc bị skip.
- 🆕 Generate coverage report: `npm run test:cov`, lưu lại screenshot/log số % coverage thực tế của `auth` và `users` module, đối chiếu với target ≥ 85% đã đặt ở Testing Strategy Master.

**Files tạo ra / sửa:** `src/main.ts`, toàn bộ Controller/DTO của `auth`, `users`, `placement`.

**Bug hay gặp & Góc nhìn System:**

- Bug: Bật Guard toàn cục có thể vô tình chặn cả `/api/docs`. Đảm bảo route Swagger được loại trừ hoặc Guard nhận biết đúng trạng thái `@Public()`.

**Commit message mẫu:** `docs(swagger): add complete phase 1 api documentation`

**Done criteria:**

- [ ] `http://localhost:3000/api/docs` hiển thị đầy đủ.
- [ ] `git tag v0.1.0-auth` thành công.
- [ ] 🆕 Toàn bộ test suite Phase 1 pass 100%, coverage `auth`/`users` ≥ 85%.

---

## Day 21–35 — Buffer Phase 1 (Test Hardening + Refactor + Explain-Back Checkpoint)

**Mục tiêu:** Mã nguồn Phase 1 được kiểm thử phủ kín tối thiểu 85% logic cốt lõi (auth, refresh token, RBAC); tối ưu cấu trúc mã nguồn.

**Nhiệm vụ cụ thể bắt buộc:**

- Hoàn thiện `auth.service.spec.ts` mock toàn bộ tương tác DB/Redis cho login, register, RTR.
- Gom nhóm chuỗi thông báo lỗi cố định, số TTL vào `src/common/constants/`.
- Nghiên cứu Request Lifecycle của NestJS: Middleware → Guard → Interceptor → Pipe → Exception Filter.
- 🆕 **Bổ sung test còn thiếu nếu chưa đạt target:** Chạy `npm run test:cov`, nếu coverage dưới 85% ở `auth`/`refresh-token`, bổ sung ngay test case còn thiếu — đặc biệt ưu tiên các nhánh `catch` (error path) thường bị bỏ quên.
- 🆕 **Viết 1 Integration Test tổng hợp luồng đầy đủ** (`auth-full-flow.integration.spec.ts`): Register → Verify Email (OTP) → Login → Refresh → Access protected route → Logout (xóa toàn bộ Redis key) — toàn bộ chạy trên DB/Redis thật qua Testcontainers, đại diện cho 1 user thật đi qua hết Phase 1.

### 🆕 EXPLAIN-BACK CHECKPOINT — PHASE 1 (Bắt buộc, không bỏ qua)

Trước khi sang Phase 2, tự thực hiện bài kiểm tra sau **không nhìn code, không nhìn tài liệu**. Ghi lại câu trả lời ra file `docs/checkpoints/phase1-explain.md`. Đây không phải thủ tục hình thức — đây là cách duy nhất phân biệt "đã code chạy được" với "đã hiểu thật":

1. Tại sao Access Token sống ngắn (15 phút) nhưng Refresh Token sống dài (7 ngày)? Nếu cả 2 đều sống dài, rủi ro gì xảy ra?
2. Giải thích chính xác chuỗi hành động khi hệ thống phát hiện Refresh Token bị dùng lại (replay attack) — tại sao phải revoke **toàn bộ** session, không chỉ session đó?
3. Tại sao `JwtStrategy.validate()` không được query DB? Nếu cần biết tài khoản có bị khóa (banned) ngay lập tức không cần chờ token hết hạn, bạn sẽ thiết kế lại thế nào mà _không_ phải query DB trên mọi request?
4. Tại sao dùng `bcrypt` với salt rounds 12 mà không phải MD5/SHA256 thông thường cho password?
5. Giải thích lỗi User Enumeration Attack — viết ra một đoạn code SAI (trả lỗi khác nhau cho "sai email" và "sai password") để minh họa, rồi tự sửa lại đúng.

**Nếu trả lời được trôi chảy cả 5 câu mà không cần mở code → bạn đã thật sự internalize Phase 1.** Nếu vướng ở câu nào, đó chính là phần cần học lại trước khi mang nó vào Phase 2 (Phase 2 sẽ build tiếp trên giả định bạn đã hiểu chắc Auth).

**Commit message mẫu:** `test(auth): harden test coverage to 85%+ and complete phase 1 explain-back checkpoint`

**Done criteria:**

- [ ] Coverage `auth`, `refresh-token`, `users` ≥ 85% (đo bằng `npm run test:cov`, không phải ước lượng).
- [ ] Integration Test full-flow Phase 1 pass.
- [ ] 🆕 File `docs/checkpoints/phase1-explain.md` hoàn thành với 5 câu trả lời tự viết, không copy lại nội dung "Bug hay gặp & Góc nhìn System" của plan.

---

# PHASE 2: ADVANCED COURSE MARKETPLACE & SEARCH ENGINE (Day 36–80)

> Lưu ý độ dài Phase: Phase gốc Day 36-75 (40 ngày), sau khi chèn Listening/Reading Module (12 ngày) và Frontend Checkpoint (7 ngày), mở rộng thành Day 36-80 (45 ngày). Đánh đổi hợp lý: đủ 4 kỹ năng ngôn ngữ cốt lõi trước khi vào Phase 3 Payment.

**Milestone:** Hệ thống quản lý khóa học với State Machine Pattern, chống BOLA, tối ưu phân trang DB, hệ thống review chống thao túng, đầy đủ Video/Quiz/Flashcard/Listening/Reading.

```
+-----------+
|   DRAFT   | <---------+
+-----------+           |
      |                 |
      | (Submit)        | (Teacher Edits)
      v                 |
+-----------+           |
|  PENDING  | ----------+
+-----------+
   /      \
(Approve) (Reject)
   v          v
+-----------+ +------------+
| PUBLISHED | |  REJECTED  |
+-----------+ +------------+
      |
      | (Archive)
      v
+-----------+
| ARCHIVED  |
+-----------+
```

---

## Day 36–38 — Course Entity & State Machine

**Mục tiêu ngày:** Bảng `courses` liên kết FK chặt với `users`; quy tắc chuyển đổi trạng thái nghiêm ngặt, không cập nhật trạng thái tùy tiện.

**Việc cần làm:**

- Enum `CourseStatus` (draft, pending, published, rejected, archived), `CourseLevel` (A1-C1).
- Entity `Course`, quan hệ `ManyToOne` với `User` (teacherId).
- Migration khởi tạo bảng `courses`.
- 🆕 Unit Test cho logic state machine (viết ngay từ ngày này, không đợi tới Day 39): test `submitForApproval()` chỉ cho phép chuyển từ `draft`/`rejected` → `pending`, throw lỗi nếu gọi từ trạng thái khác (ví dụ từ `published` → `pending` phải bị chặn).

**Files tạo ra / sửa:** `src/modules/courses/entities/course.entity.ts`, `src/migrations/[Timestamp]-CreateCoursesTable.ts`, 🆕 `src/modules/courses/course-state-machine.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- System Look (Mô hình Trạng thái An toàn): Không bao giờ cho API cập nhật trạng thái bằng truyền trực tiếp `{ status: 'published' }`. Trạng thái phải qua hành vi cụ thể (`submitForApproval`, `approve`).

**Commit message mẫu:** `feat(courses): add course entity with status state machine`

**Done criteria:**

- [ ] Migration chứa đầy đủ FK, default `enrolledCount = 0`, `ratingAvg = 0`.
- [ ] 🆕 Unit test state machine pass: mọi transition không hợp lệ đều bị chặn (test đủ ma trận chuyển trạng thái, không chỉ happy path).

---

## Day 39–43 — CRUD Khóa học & Chống BOLA

**Mục tiêu ngày:** API tạo/cập nhật/phân trang khóa học; hàm `assertOwnership` triệt tiêu BOLA.

**Việc cần làm:**

- Module `courses`: module, service, controller.
- `CreateCourseDto`, `FilterCourseDto`.
- Hàm `assertOwnership(courseId, teacherId)` dùng chung.
- API phân trang bằng `findAndCount`, trả `data` + `meta`.
- 🆕 **Integration Test BOLA (bắt buộc, đây là test quan trọng nhất của Phase 2):** Tạo 2 user Teacher A và B thật trong DB test. Teacher A tạo course. Teacher B gọi `PUT /courses/:id` (ID của course A) → phải nhận **404**, không phải 403 (đúng yêu cầu che giấu sự tồn tại). Verify course A trong DB **không bị thay đổi** sau request này.
- 🆕 Unit Test cho `assertOwnership`: mock Repository trả `null` khi `where: { id, teacherId }` không khớp → throw `NotFoundException`.
- 🆕 Integration Test phân trang: tạo 25 course trong DB test, gọi API với `page=2&limit=10`, assert đúng 10 record, `meta.total = 25`, `meta.totalPages = 3`.

**Files tạo ra / sửa:** `src/modules/courses/courses.module.ts`, `src/modules/courses/courses.service.ts`, `src/modules/courses/courses.controller.ts`, `src/modules/courses/dto/create-course.dto.ts`, `src/modules/courses/dto/filter-course.dto.ts`, 🆕 `src/modules/courses/tests/bola.integration.spec.ts`, 🆕 `src/modules/courses/tests/pagination.integration.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- **BOLA (OWASP API #1):** Giáo viên A gửi `PUT /courses/123` mà code chỉ `findOne(123)` rồi update không đối chiếu chủ sở hữu → A có thể sửa khóa học của B chỉ bằng đổi ID trên URL. Bắt buộc query `where: { id: courseId, teacherId: userId }`. Không tìm thấy → `NotFoundException` (404), không phải `ForbiddenException` (403), để che giấu sự tồn tại của ID.

**Commit message mẫu:** `feat(courses): implement course crud with ownership check and pagination`

**Done criteria:**

- [ ] Giáo viên B sửa course của A → 404.
- [ ] API phân trang trả đúng cấu trúc `data` + `meta`.
- [ ] 🆕 Integration Test BOLA và phân trang pass trên DB thật.

---

## Day 44–45 — Workflow Xét duyệt Khóa học (Admin)

**Mục tiêu ngày:** Phân hệ Admin phê duyệt/từ chối khóa học pending kèm lý do.

**Việc cần làm:**

- `admin-courses.controller.ts`, giới hạn role `admin`.
- API `GET /admin/courses?status=pending`.
- API `PATCH /admin/courses/:id/approve`.
- API `PATCH /admin/courses/:id/reject` yêu cầu `rejectionReason`.
- 🆕 Unit Test: approve course có `totalLessons == 0` → throw `BadRequestException`. Đây là rule nghiệp vụ dễ bị quên test nhất vì nó nằm ở "Bug hay gặp" chứ không phải luồng chính.
- 🆕 Integration Test: reject với `rejectionReason` < 10 ký tự → 400; reject hợp lệ → course chuyển `rejected`, `rejectionReason` lưu đúng trong DB.

**Files tạo ra / sửa:** `src/modules/courses/admin-courses.controller.ts`, `src/modules/courses/dto/reject-course.dto.ts`, `src/modules/courses/courses.service.ts`, 🆕 `src/modules/courses/admin-courses.service.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- Bug: Cần kiểm tra logic nghiệp vụ: nếu `totalLessons == 0`, từ chối approve một khóa học rỗng ra chợ công khai.

**Commit message mẫu:** `feat(admin): add course approval and rejection workflow`

**Done criteria:**

- [ ] Reject thiếu/ngắn lý do → 400.
- [ ] Approve hợp lệ → `published`.
- [ ] 🆕 Unit test chặn approve course rỗng pass.

---

## Day 46–51 — Lesson Management & Reorder Algorithm

**Mục tiêu ngày:** Entity bài học đa loại hình (Video/Flashcard/Quiz/Reading/Listening); thuật toán reorder bằng 1 transaction duy nhất.

**Việc cần làm:**

- Enum `LessonType`: video, flashcard, quiz, reading, 🆕 listening.
- Entity `Lesson`, FK `Course` với `onDelete: 'CASCADE'`.
- API tạo bài học, `orderIndex = max + 1`.
- API `PATCH /courses/:id/lessons/reorder` nhận `{ orderedIds: [...] }`.
- Thuật toán cập nhật hàng loạt dùng Transaction (`QueryRunner`).
- 🆕 **Integration Test reorder (bắt buộc):** Tạo 5 lesson, gọi reorder với mảng thứ tự mới, assert `order_index` của cả 5 lesson được cập nhật đúng trong **1 transaction** — verify bằng cách đo số lượng query thực thi (dùng TypeORM logger trong test, assert không có N+1, tức không có 5 query `UPDATE` riêng lẻ mà phải gói trong transaction).
- 🆕 Integration Test cascade delete: xóa course → toàn bộ lesson con bị xóa theo, verify bằng query DB thật.

**Files tạo ra / sửa:** `src/modules/lessons/entities/lesson.entity.ts`, `src/modules/lessons/dto/create-lesson.dto.ts`, `src/modules/lessons/dto/reorder-lessons.dto.ts`, `src/modules/lessons/lessons.service.ts`, `src/modules/lessons/lessons.controller.ts`, 🆕 `src/modules/lessons/tests/reorder.integration.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- **Anti-Pattern N+1 Queries:** Vòng lặp `for` gọi 20 `update()` độc lập sẽ hủy diệt hiệu năng khi nhiều người dùng thao tác cùng lúc. Giải pháp: `QueryRunner`/Transaction gom toàn bộ update vào 1 phiên xử lý.

**Commit message mẫu:** `feat(lessons): add lesson crud with video upload and reorder`

**Done criteria:**

- [ ] Reorder cập nhật đúng `order_index` theo thứ tự mảng.
- [ ] Xóa course → lesson liên quan bị xóa theo (Cascade).
- [ ] 🆕 Test xác nhận reorder chạy trong transaction, không phải N+1 query rời rạc.

---

## Day 52–54 — Bộ lọc Tìm kiếm Nâng cao & Bảo vệ contentUrl

**Mục tiêu ngày:** Tìm kiếm linh hoạt theo từ khóa/giá/cấp độ; che giấu `contentUrl` với học viên chưa mua.

**Việc cần làm:**

- `SelectQueryBuilder` cho tìm kiếm động.
- Tìm kiếm mờ bằng `ILIKE`.
- `findOne()`: nếu chưa mua và `isFree == false` → set `contentUrl = null` trước khi trả response.
- 🆕 **Integration Test bảo vệ contentUrl (bắt buộc, mức độ quan trọng tương đương BOLA test):** Tạo course có 3 lesson (1 `isFree: true`, 2 `isFree: false`). User chưa mua gọi API xem chi tiết → assert 2 lesson trả `contentUrl: null`, lesson free vẫn có URL. Sau đó tạo Enrollment cho user này (giả lập đã mua), gọi lại API → cả 3 lesson đều có `contentUrl` đầy đủ.

**Files tạo ra / sửa:** `src/modules/courses/dto/filter-course.dto.ts`, `src/modules/courses/courses.service.ts`, 🆕 `src/modules/courses/tests/content-protection.integration.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- **Data Leakage:** Không phó thác việc che giấu cho Frontend — kẻ xấu đọc trực tiếp JSON qua tab Network. Bảo mật phải thực thi triệt để ở Backend.

**Commit message mẫu:** `feat(courses): add search with pagination and content url protection`

**Done criteria:**

- [ ] User chưa mua → `contentUrl: null` trừ bài `isFree`.
- [ ] 🆕 Integration Test full cycle (chưa mua → đã mua) pass đúng cả 2 trạng thái.

---

## Day 55–57 — Review System & Auto-update Rating

**Mục tiêu ngày:** Học viên đã mua được review; tự động tính `ratingAvg`/`ratingCount` ở tầng DB.

**Việc cần làm:**

- Entity `Review`, `@Unique(['userId', 'courseId'])`.
- API `POST /reviews`: kiểm tra đã mua khóa học chưa.
- SQL thuần `updateCourseRating(courseId)` dùng `SELECT AVG(rating)`.
- 🆕 **Integration Test concurrency rating (bắt buộc):** Tạo 5 user đã mua course, gửi 5 review **đồng thời** (`Promise.all`) với rating khác nhau, assert `ratingAvg` cuối cùng đúng bằng trung bình toán học của 5 rating đó — đây là test trực tiếp chứng minh hiểu đúng lý do "đẩy tính toán cho SQL, không tính ở Node.js" được cảnh báo bên dưới.
- 🆕 Unit Test: user review course thứ 2 (đã review trước đó) → bắt lỗi unique constraint, trả lỗi phù hợp, không tạo row rác.

**Files tạo ra / sửa:** `src/modules/reviews/entities/review.entity.ts`, `src/modules/reviews/dto/create-review.dto.ts`, `src/modules/reviews/reviews.service.ts`, `src/modules/reviews/reviews.controller.ts`, 🆕 `src/modules/reviews/tests/rating-concurrency.integration.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- Tránh Race Condition & sai lệch số thập phân: không kéo toàn bộ review lên Node.js tính trung bình rồi lưu ngược lại. Đẩy cho SQL `AVG()` với `numeric(3,2)`.

**Commit message mẫu:** `feat(reviews): add review system with rating auto-update`

**Done criteria:**

- [ ] Review lần 2 cùng course → bị chặn, không tạo row rác.
- [ ] `ratingAvg`/`ratingCount` tự động cập nhật đúng.
- [ ] 🆕 Test 5 review đồng thời → `ratingAvg` chính xác tuyệt đối, không lệch do race condition.

---

## Day 58–60 — Database Indexing & Đo đạc Hiệu năng

**Mục tiêu ngày:** Index đúng cột tìm kiếm/sắp xếp; chứng minh hiệu năng bằng `EXPLAIN ANALYZE`.

**Việc cần làm:**

- Migration tạo index: composite `idx_courses_status_level ON courses(status, level)`.
- Index đơn trên `course_id` (lesson), FK đăng ký học.
- Chạy `EXPLAIN ANALYZE` trên DBeaver cho câu lệnh tìm kiếm khóa học.
- 🆕 Viết script `scripts/seed-performance-test.ts` tạo 10,000 course giả lập (dùng `faker`), chạy `EXPLAIN ANALYZE` trước và sau khi thêm index, **lưu lại cả 2 kết quả vào file `docs/performance/phase2-index-benchmark.md`** — đây là cách chứng minh hiểu biết thật bằng số liệu cụ thể, không phải lời khẳng định suông.

**Files tạo ra / sửa:** `src/migrations/[Timestamp]-AddPerformanceIndexes.ts`, 🆕 `scripts/seed-performance-test.ts`, 🆕 `docs/performance/phase2-index-benchmark.md`

**Bug hay gặp & Góc nhìn System:**

- Đừng lạm dụng tạo index bừa bãi — mỗi index tốn thêm chi phí ghi (`INSERT`/`UPDATE`/`DELETE`). Chỉ index cột Read-Heavy, ít biến động.

**Commit message mẫu:** `perf(db): add indexes for course search and enrollment queries`

**Done criteria:**

- [ ] `EXPLAIN ANALYZE` chuyển từ `Seq Scan` sang `Index Scan`.
- [ ] 🆕 File benchmark có số liệu thật (thời gian ms trước/sau) trên dataset 10,000 record, không phải ước lượng.

---

## Day 61–72 — 🆕 LISTENING & READING MODULE

**Day 61-63:** Entity & Migration `ListeningExercise`, `ListeningQuestion`, `ListeningAttempt` — upload audio lên Cloudinary.

- 🆕 Unit Test chấm điểm Listening: test boundary (0 câu đúng, toàn bộ đúng, một nửa đúng).

**Day 64-66:** API làm bài Listening & chấm điểm tự động, ẩn `transcript`/`correctAnswer` trước khi nộp bài.

- 🆕 Integration Test: gọi API lấy đề Listening → response không chứa `correctAnswer` lẫn `transcript`; nộp bài → response chấm điểm xuất hiện đúng, transcript hiện ra sau khi nộp.

**Day 67-69:** Entity & API module Reading (`ReadingPassage`, `ReadingQuestion`, `ReadingAttempt`) — bài học tư duy trừu tượng hóa logic chấm điểm (ADR).

- 🆕 Viết ADR (`docs/decisions/001-listening-reading-scoring-abstraction.md`) so sánh 2 phương án: (a) viết riêng `ListeningScoringService` và `ReadingScoringService` tách biệt hoàn toàn, (b) trừu tượng hóa thành `BaseQuizScoringService` dùng chung cho cả Quiz/Listening/Reading. Quyết định cuối kèm lý do — đây chính là tài liệu chứng minh tư duy kiến trúc thật, không phải chỉ "code theo hướng dẫn".
- 🆕 Unit Test cho lớp scoring đã chọn ở ADR, đảm bảo logic dùng lại được giữa Listening và Reading mà không copy-paste.

**Day 70-72:** API tổng hợp `GET /me/skill-report`, hoàn thiện Swagger, viết Unit Test cho cả 2 module mới.

- 🆕 Integration Test `skill-report`: tạo dữ liệu attempt giả cho cả 4 kỹ năng (Quiz, Flashcard, Listening, Reading) của 1 user, gọi API, assert số liệu tổng hợp đúng từng kỹ năng.
- 🆕 Coverage check: `listening` và `reading` module phải đạt ≥ 80% trước khi sang Phase 2.5.

**Commit message mẫu:** `feat(listening-reading): implement listening/reading modules with shared scoring abstraction`

**Done criteria:**

- [ ] API đề Listening/Reading không rò rỉ `correctAnswer`/`transcript` trước khi nộp.
- [ ] 🆕 File ADR hoàn chỉnh với 2 phương án so sánh thật, không phải mô tả 1 chiều.
- [ ] 🆕 `skill-report` trả đúng số liệu tổng hợp 4 kỹ năng, verify bằng Integration Test trên dữ liệu giả lập thật.

---

## Day 73–79 — 🆕 PHASE 2.5: FRONTEND INTEGRATION CHECKPOINT

Dựng Next.js App Router + TailwindCSS + shadcn/ui, kết nối thật vào API Course List/Detail/Login/Register đã hoàn thiện ở Day 36-72, để cảm nhận trực tiếp điểm yếu UX của API tự thiết kế trước khi vào Phase 3.

- 🆕 **Bổ sung góc nhìn QA:** Khi kết nối Frontend thật, ghi lại vào `docs/checkpoints/phase2.5-api-friction-log.md` mọi điểm khó chịu khi dùng API từ góc nhìn Frontend (ví dụ: thiếu field, format ngày không nhất quán, lỗi 400 không rõ field nào sai). Đây là bài tập "ăn cơm chó của chính mình" (dogfooding) — kỹ năng mà hầu hết intern backend không bao giờ được thực hành, vì luôn có người khác code Frontend giùm.

**Done criteria:**

- [ ] Đăng nhập thật qua FE, gọi API `/courses` phân trang trên UI thật, gọi `/me/skill-report` hiển thị dashboard cơ bản.
- [ ] 🆕 File `phase2.5-api-friction-log.md` có ít nhất 5 vấn đề UX/API thật được ghi nhận và đề xuất sửa (sẽ áp dụng sửa nếu còn thời gian buffer).

---

## Day 80 — Tổng duyệt Phase 2: Bulk Flashcard, Bảo mật Quiz & Đóng dấu Phiên bản

**Mục tiêu:** API tạo hàng loạt Flashcard; module Quiz bảo mật đáp án tuyệt đối.

**Việc cần làm:**

- API bulk insert Flashcard dùng `insert()` của Repository, không vòng lặp.
- Bảng câu hỏi Quiz: API lấy câu hỏi tuyệt đối không chứa đáp án đúng.
- Rà soát toàn bộ Phase 2 theo checklist.
- 🆕 **Chạy toàn bộ Test Suite Phase 2** (Unit + Integration + E2E từ Day 36-79): bắt buộc 100% pass trước khi tag version. Generate coverage report, đối chiếu target ≥ 80% cho `courses`, `lessons`, `reviews`, `listening`, `reading`.
- 🆕 Unit Test bulk insert: test với mảng 200 flashcard, assert chỉ **1 câu lệnh SQL `INSERT`** được thực thi (đo qua TypeORM query logger), không phải 200 query rời.

**Commit message mẫu:** `feat(quiz): implement interactive quiz and bulk flashcard insertion`

### 🆕 EXPLAIN-BACK CHECKPOINT — PHASE 2 (Bắt buộc)

Trả lời không nhìn code, ghi vào `docs/checkpoints/phase2-explain.md`:

1. Giải thích lỗ hổng BOLA bằng ví dụ cụ thể của riêng bạn (không lặp lại ví dụ Giáo viên A/B trong plan) — tại sao trả 404 thay vì 403 lại quan trọng?
2. Tại sao việc che giấu `contentUrl` phải làm ở Backend, không thể chỉ làm ở Frontend? Một kẻ tấn công sẽ khai thác lỗ hổng này bằng công cụ gì cụ thể?
3. Tại sao tính `ratingAvg` phải đẩy cho SQL `AVG()` thay vì tính ở code Node.js? Mô tả chính xác kịch bản race condition sẽ xảy ra nếu tính ở Node.js.
4. Bạn đã chọn phương án nào trong ADR Listening/Reading scoring? Nếu được làm lại, bạn có chọn khác không? Tại sao?
5. Composite Index `(status, level)` hoạt động khác gì so với 2 index đơn riêng biệt trên từng cột? Khi nào composite index _không_ giúp ích?

**Done criteria:**

- [ ] `git tag v0.2.0-marketplace` thành công.
- [ ] 🆕 Toàn bộ Test Suite Phase 2 pass 100%, coverage đạt target.
- [ ] 🆕 File `docs/checkpoints/phase2-explain.md` hoàn thành.

---

# PHASE 3: SECURE TRANSACTIONAL PAYMENT & IDEMPOTENT ENROLLMENT (Day 81–115)

> Ghi chú dịch ngày: Phase gốc Day 76-110, dịch lùi 5 ngày thành Day 81-115 do Phase 2 mở rộng. Nội dung kỹ thuật giữ nguyên 100%.

**Milestone:** Tích hợp VNPay Sandbox, kiến trúc Webhook IPN siêu bảo mật, SERIALIZABLE Transaction, Idempotency Check tuyệt đối.

> 🆕 **Đây là Phase rủi ro cao nhất của toàn dự án** — bất kỳ lỗi logic nào ở đây trong thực tế đồng nghĩa với mất tiền thật hoặc giao hàng (khóa học) sai. Coverage target Unit Test ở Phase này nâng lên **90%** (so với 80-85% các phase khác), và testing concurrency là **bắt buộc tuyệt đối**, không phải optional.

---

## Day 81–83 — Payment Ledger Schema

**Mục tiêu ngày:** Entity quản lý hóa đơn chặt chẽ, lưu vết lịch sử không thể sửa tùy tiện, sẵn sàng đối soát.

**Việc cần làm:**

- Enum `PaymentStatus`: pending, completed, failed, refunded.
- Entity `Payment`, `orderId` là unique key.
- Cột `amount` kiểu `decimal(precision: 10, scale: 2)`.
- Migration khởi tạo bảng `payments`.
- 🆕 Unit Test: thử lưu `amount` dạng `float` (ví dụ `0.1 + 0.2`) vào cột `decimal` qua TypeORM, assert giá trị lưu/đọc lại **chính xác tuyệt đối** (`0.30`), không bị lỗi làm tròn nhị phân — đây là test minh họa trực tiếp cho "Quy tắc tài chính cốt lõi" bên dưới.

**Files tạo ra / sửa:** `src/modules/payments/entities/payment.entity.ts`, `src/migrations/[Timestamp]-CreatePaymentsTable.ts`, 🆕 `src/modules/payments/tests/decimal-precision.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- **Quy tắc tài chính cốt lõi:** Tuyệt đối không dùng `float`/`double` cho tiền tệ (lỗi làm tròn nhị phân: `0.1 + 0.2 = 0.30000000000000004`). Luôn dùng `decimal`/`numeric`.

**Commit message mẫu:** `feat(payment): add payment ledger entity with financial precision`

**Done criteria:**

- [ ] Bảng `payments` có index unique trên `orderId`.
- [ ] 🆕 Test decimal precision pass, chứng minh không có sai lệch số học tiền tệ.

---

## Day 84–86 — Tích hợp VNPay & HMAC-SHA512

**Mục tiêu ngày:** Sinh mã hóa đơn nội bộ, build link thanh toán VNPay đúng chuẩn ký mã alphabet.

**Việc cần làm:**

- Đọc tài liệu VNPay Sandbox.
- Biến môi trường: `vnp_TmnCode`, `vnp_HashSecret`, `vnp_ReturnUrl`.
- `PaymentsService.initiatePayment(userId, courseId)`.
- Thuật toán sắp xếp tham số alphabet tăng dần, băm `HMAC-SHA512` qua module `crypto`.
- 🆕 **Unit Test chữ ký HMAC (bắt buộc):** Dùng test vector cố định (input params + secret key cố định) → assert output hash đúng **chính xác từng ký tự** so với giá trị mong đợi đã tính trước bằng tay/công cụ ngoài. Đây là loại test "golden value" — không test "chạy không lỗi" mà test "ra đúng giá trị toán học chính xác", vì sai 1 ký tự trong tham số đầu vào sẽ cho ra hash hoàn toàn khác.
- 🆕 Unit Test: kiểm tra số tiền truyền lên VNPay đã được nhân 100 đúng cách (`50000 VND` → giá trị truyền là `5000000`).

**Files tạo ra / sửa:** `src/modules/payments/payments.module.ts`, `src/modules/payments/payments.service.ts`, `src/modules/payments/payments.controller.ts`, `src/modules/payments/dto/initiate-payment.dto.ts`, 🆕 `src/modules/payments/tests/hmac-signature.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- Bug: Lỗi Invalid Signature 90% do quên sắp xếp tham số theo alphabet, hoặc quên nhân 100 số tiền.

**Commit message mẫu:** `feat(payment): implement vnpay payment url generation with hmac-sha512`

**Done criteria:**

- [ ] `POST /payments/initiate` trả URL hợp lệ, điều hướng đúng tới VNPay Sandbox.
- [ ] 🆕 Golden-value test HMAC pass chính xác tuyệt đối.

---

## Day 87–89 — Webhook IPN, Idempotency & SERIALIZABLE Transaction

**Mục tiêu ngày:** API IPN đạt chuẩn bảo mật tuyệt đối; Idempotency Check; SERIALIZABLE Transaction chống nhân bản dữ liệu.

**Việc cần làm:**

- API `POST /payments/vnpay-ipn`, `@Public()`.
- Tái tạo chữ ký, đối chiếu với chữ ký nhận được.
- Idempotency Check: nếu `payment.status == COMPLETED` → trả ngay `RspCode: '00'`, dừng xử lý.
- Bọc update Payment + tạo Enrollment + tăng `enrolledCount` trong transaction `SERIALIZABLE`.
- 🆕 **Integration Test giả mạo chữ ký (bắt buộc):** Gửi IPN với chữ ký sai → assert response `RspCode: '97'`, **và** assert trạng thái Payment trong DB **không** bị thay đổi (vẫn `pending`) — nhiều intern chỉ test response code đúng mà quên verify DB không bị side-effect khi chữ ký sai.
- 🆕 **Integration Test concurrency — đây là test quan trọng nhất của toàn bộ 205 ngày:** Dùng `Promise.all` gửi **5 request IPN giống hệt nhau** (cùng `orderId`, chữ ký hợp lệ) đồng thời vào hệ thống đang chạy với DB thật qua Testcontainers. Assert:
  - Đúng **1** bản ghi `Enrollment` được tạo (query `COUNT(*)` từ DB).
  - `enrolledCount` của course tăng đúng **+1**, không phải +5.
  - Payment status chuyển `COMPLETED` đúng 1 lần, 4 request còn lại nhận `RspCode: '00'` (báo nhận thành công nhưng không xử lý lại).
- 🆕 Unit Test riêng cho transaction isolation level: assert `SERIALIZABLE` được truyền đúng vào `queryRunner.startTransaction()` (kiểm tra qua spy/mock, không cần DB thật cho phần này).

**Files tạo ra / sửa:** `src/modules/payments/payments.controller.ts`, `src/modules/payments/payments.service.ts`, `src/modules/enrollments/entities/enrollment.entity.ts`, 🆕 `src/modules/payments/tests/ipn-concurrency.integration.spec.ts`, 🆕 `src/modules/payments/tests/ipn-signature-forgery.integration.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- **Tại sao bắt buộc SERIALIZABLE:** Cổng thanh toán có thể gửi 3-4 IPN trùng lặp do retry mạng. Với `Read Committed` mặc định, cả 3 request có thể đồng thời vượt qua Idempotency Check (vì update của request 1 chưa kịp lưu xong). Hệ quả: 3 Enrollment trùng lặp, `enrolledCount` tăng sai x3. `SERIALIZABLE` biến giao dịch song song thành tuần tự nghiêm ngặt, request sau can thiệp vào vùng dữ liệu đang khóa sẽ bị fail ngay.

**Commit message mẫu:** `feat(payment): implement vnpay ipn handler with serializable transaction`

**Done criteria:**

- [ ] IPN giả mạo chữ ký → `RspCode: '97'`, Payment không đổi trạng thái.
- [ ] 🆕 5 IPN đồng thời → đúng 1 Enrollment, `enrolledCount` +1 chính xác (verify bằng Integration Test thật, không phải suy luận lý thuyết).

---

## Day 90–115 — Enrollment Guard, Coupon, Teacher Revenue Dashboard & Buffer Phase 3

> Ghi chú: Đã chèn Coupon (Phần 5.1.B), ước tính thêm 4-5 ngày so với gốc.

**Mục tiêu:** Đăng ký học miễn phí không qua cổng thanh toán; API thống kê doanh thu giáo viên; Integration Test toàn diện luồng thanh toán; tích hợp Coupon.

**Việc cần làm:**

- API `POST /courses/:id/enroll` cho course `price == 0`, bỏ qua VNPay.
- `EnrollmentGuard`: chặn API xem nội dung bài học nếu chưa có Enrollment.
- API thống kê doanh thu: `GROUP BY` theo tuần/tháng.
- 🆕 Entity `Coupon` + API `POST /payments/validate-coupon`, tích hợp vào `initiatePayment` đã viết ở Day 84-86. Dùng `SELECT ... FOR UPDATE` (pessimistic lock) khi kiểm tra và tăng `usedCount`.
- Hoàn thành Integration Test toàn diện giả lập trọn vẹn luồng từ initiate đến IPN.

**🆕 Testing chi tiết cho phần Coupon (mức độ quan trọng tương đương IPN concurrency test ở Day 87-89, vì cùng là race condition tài chính):**

- 🆕 **Integration Test concurrency Coupon (bắt buộc):** Tạo coupon với `maxUses = 1`. Gửi **10 request đồng thời** áp dụng coupon này từ 10 user khác nhau. Assert đúng **1** request thành công, 9 request còn lại nhận lỗi "coupon đã hết lượt dùng". Verify `usedCount` trong DB cuối cùng đúng bằng `1`, không vượt quá `maxUses` dù có 10 request đua nhau.
- 🆕 Unit Test: coupon hết hạn (`expiresAt` trong quá khứ) → validate trả lỗi, không cho áp dụng dù `usedCount` chưa đạt `maxUses`.
- 🆕 Unit Test: `EnrollmentGuard` chặn đúng — user chưa có Enrollment gọi API xem lesson → 403; user có Enrollment → cho qua. Test riêng case Enrollment bị set `status = 'refunded'` (nếu có) → vẫn phải chặn, không chỉ check "có record Enrollment hay không" mà phải check đúng trạng thái.
- 🆕 E2E Test full luồng: Register → Browse course → Apply coupon → Initiate payment → Simulate IPN success → Access lesson content → Verify `contentUrl` không còn `null` (nối lại với test Day 52-54 ở Phase 2, đây là test xác nhận tích hợp đúng giữa 2 Phase).

**Files tạo ra / sửa:** (giữ nguyên theo plan gốc) + 🆕 `src/modules/payments/tests/coupon-concurrency.integration.spec.ts`, 🆕 `test/full-payment-flow.e2e-spec.ts`

**Commit message mẫu:** `feat(enrollment): add enrollment guard, coupon system and teacher revenue dashboard analytics`

### 🆕 EXPLAIN-BACK CHECKPOINT — PHASE 3 (Bắt buộc, quan trọng nhất trong 5 checkpoint)

Trả lời không nhìn code, ghi vào `docs/checkpoints/phase3-explain.md`:

1. Vẽ lại (bằng tay, giấy hoặc draw.io) timeline của 5 request IPN đồng thời gửi tới hệ thống KHÔNG có SERIALIZABLE — chỉ ra chính xác tại bước nào 3 request "nhìn thấy" trạng thái `pending` cùng lúc và dẫn tới nhân bản Enrollment.
2. Tại sao Idempotency Check (so sánh status trong DB) là chưa đủ nếu không có transaction isolation đi kèm? Cho ví dụ cụ thể bằng số liệu thời gian (mili-giây) minh họa.
3. `SELECT ... FOR UPDATE` (pessimistic lock) ở Coupon khác gì so với `SERIALIZABLE` transaction ở IPN? Tại sao chọn 2 kỹ thuật khác nhau cho 2 bài toán tương tự nhau (cả 2 đều là race condition)?
4. Nếu VNPay gọi IPN nhưng server của bạn đang downtime đúng lúc đó, điều gì xảy ra với đơn hàng? Bạn có cơ chế nào để không mất tiền của học viên trong trường hợp này không? (Nếu chưa có, đây là gợi ý cho phần cải tiến — ghi nhận lại, không cần code thêm).
5. Giải thích bằng lời của riêng bạn (không paste lại định nghĩa) sự khác biệt giữa `float` và `decimal` ở tầng lưu trữ nhị phân — tại sao đây không chỉ là "quy tắc nên theo" mà là "bắt buộc tuyệt đối" cho hệ thống tài chính.

**Done criteria:**

- [ ] Coupon hết hạn/vượt `maxUses` → từ chối rõ ràng.
- [ ] `git tag v0.3.0-payment` thành công.
- [ ] 🆕 Toàn bộ Test Suite Phase 3 pass 100%, coverage `payments` module ≥ 90%.
- [ ] 🆕 File `docs/checkpoints/phase3-explain.md` hoàn thành — đặc biệt câu 1 phải có hình vẽ/diagram timeline thật, không chỉ mô tả bằng chữ.

---

# PHASE 4: GAMIFIED LEARNING ENGINE & TIMEZONE-SAFE ANALYTICS (Day 116–165)

> Ghi chú dịch ngày: Phase gốc Day 111-155, dịch lùi 5 ngày + mở rộng thêm 5 ngày cho Notification System.

**Milestone:** Theo dõi tiến độ chống Zero-Division, Streak Timezone-Safe, Spaced Repetition (SM2), 🆕 Notification + Wishlist.

---

## Day 116–121 — Lesson Progress Tracking & Zero-Division Protection

**Mục tiêu ngày:** DB lưu vết hoàn thành bài học; tính % tiến độ an toàn tuyệt đối trước lỗi chia cho 0.

**Việc cần làm:**

- Entity `LessonProgress`, `@Unique(['userId', 'lessonId'])`.
- API `POST /lessons/:id/complete`.
- `ProgressService` tính tổng hợp tiến độ.
- Bọc điều kiện: `totalLessons == 0` → trả 0% ngay, không đưa 0 vào mẫu số.
- 🆕 **Unit Test Zero-Division (bắt buộc, đây là test boundary kinh điển):** Test case course có `totalLessons = 0` → API trả `0%`, không throw lỗi, không trả `Infinity`/`NaN`. Test case `totalLessons = 1, completedLessons = 1` → `100%` chính xác (không phải `99.999...` do lỗi float). Test case `completedLessons > totalLessons` (dữ liệu bất thường, ví dụ do bug ở chỗ khác) → hệ thống phải tự bảo vệ, cap tối đa ở `100%`, không trả `120%`.

**Files tạo ra / sửa:** `src/modules/progress/entities/lesson-progress.entity.ts`, `src/modules/progress/progress.service.ts`, `src/modules/progress/progress.controller.ts`, 🆕 `src/modules/progress/progress.service.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- **Division by Zero:** `(completedLessons / totalLessons) * 100` với `totalLessons = 0` → `Infinity` trong JS, có thể crash query SQL. Dùng toán tử ba ngôi hoặc `NULLIF(count(*), 0)`.

**Commit message mẫu:** `feat(progress): add lesson progress tracking with zero-division protection`

**Done criteria:**

- [ ] Course rỗng → tiến độ 0%, không crash.
- [ ] 🆕 3 test case boundary (0 lesson, 100% đúng, dữ liệu bất thường > 100%) đều pass.

---

## Day 122–128 — Streak Algorithm Timezone-Safe (Luxon)

**Mục tiêu ngày:** Thuật toán chuỗi ngày học liên tiếp an toàn trước sai lệch múi giờ quốc tế.

**Việc cần làm:**

- Cài đặt: `npm install luxon`, dev: `@types/luxon`.
- `StreakService`.
- Quy đổi múi giờ về `Asia/Ho_Chi_Minh` bằng Luxon trước khi so sánh khoảng cách ngày với `lastActive`.
- Viết 5 kịch bản Unit Test (đã có trong plan gốc — xem chi tiết bên dưới).
- 🆕 **Mở rộng bộ test lên tối thiểu 8 kịch bản** (5 kịch bản gốc + 3 bổ sung bắt buộc):
  1. (gốc) Học liên tiếp 2 ngày → streak tăng đúng +1.
  2. (gốc) Bỏ 1 ngày giữa → streak reset về 1.
  3. (gốc) Học 2 lần trong cùng 1 ngày → streak không tăng thêm lần 2.
  4. (gốc) Học đúng lúc nửa đêm theo giờ VN → không bị tính lệch ngày.
  5. (gốc) User ở múi giờ khác (ví dụ UTC+0, học lúc 23:00 UTC = 06:00 sáng hôm sau giờ VN) → streak tính theo giờ VN cố định, không theo giờ local của user.
  6. 🆕 Học vào đúng thời điểm chuyển đổi DST (Daylight Saving Time) nếu áp dụng cho người dùng ở múi giờ có DST — kiểm tra Luxon xử lý đúng, không lệch giờ.
  7. 🆕 `lastActive` là `null` (user lần đầu hoàn thành bài học) → streak khởi tạo đúng = 1, không throw lỗi khi so sánh với giá trị null.
  8. 🆕 Test dùng `jest.useFakeTimers().setSystemTime(...)` để giả lập chính xác thời điểm server chạy ở múi giờ UTC (mô phỏng server thật thường chạy UTC) — xác nhận kết quả streak không đổi dù giờ server là UTC hay giờ VN.

**Files tạo ra / sửa:** `src/modules/progress/streak.service.ts`, `src/modules/progress/tests/streak.service.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- **The Timezone Trap:** Nếu server chạy UTC và code dùng `new Date()` trực tiếp không quy đổi, học lúc 06:00 sáng giờ VN (23:00 UTC hôm trước) bị ghi nhận sai ngày, gây reset streak oan uổng. Bắt buộc quy đổi `startOf('day')` theo `Asia/Ho_Chi_Minh` trước khi tính khoảng cách.

**Commit message mẫu:** `feat(progress): implement timezone-safe streak algorithm with unit tests`

**Done criteria:**

- [ ] `npm run test -- streak.service.spec.ts` toàn bộ pass.
- [ ] 🆕 Đạt tối thiểu 8/8 kịch bản (không phải 5/5 như bản gốc) — 3 kịch bản bổ sung (DST, null lastActive, fake server UTC) là điều kiện bắt buộc, không phải optional.

---

## Day 129–160 — Spaced Repetition (SM2), Wishlist, Notification & Buffer Phase 4

**Mục tiêu:** Lịch ôn tập Flashcard tự động theo SM2; 🆕 Wishlist; 🆕 Notification qua Event-Driven; tổng duyệt Phase 4.

**Việc cần làm:**

- Entity `FlashcardProgress`: `easinessFactor`, `repetitions`, `interval`.
- API `POST /flashcards/:id/review` nhận điểm 0-5.
- Thuật toán SM2 tính `nextReviewAt`.
- 🆕 Wishlist: Entity, API toggle thêm/xóa idempotent, chống Race Condition double-click.
- 🆕 Notification: Entity, `EventEmitter2` tách business logic (approve course, payment success, new review) khỏi việc tạo thông báo.
- Rà soát toàn bộ hệ thống chấm điểm theo checklist.

**🆕 Testing chi tiết SM2 (đây là thuật toán toán học phức tạp nhất của Phase 4, cần test kỹ hơn 1 dòng "5/5 pass" ở bản gốc):**

- 🆕 Unit Test SM2 — test theo đúng công thức khoa học, không chỉ test "có chạy":
  - Điểm đánh giá = 0-2 (trả lời kém) → `repetitions` reset về 0, `interval` reset về 1 ngày.
  - Điểm đánh giá = 3 (đủ) → `interval` tăng nhẹ theo `easinessFactor` hiện tại.
  - Điểm đánh giá = 5 (xuất sắc liên tục nhiều lần) → `interval` giãn cách tăng theo cấp số (test ít nhất 3 lần review liên tiếp điểm 5, assert `interval` lần 3 > lần 2 > lần 1).
  - `easinessFactor` không bao giờ giảm xuống dưới ngưỡng tối thiểu khoa học là `1.3` (đây là rule của SM2 gốc, dễ bị bỏ quên khi tự implement).
- 🆕 Boundary test: điểm đánh giá ngoài khoảng 0-5 (ví dụ -1 hoặc 6) → bị validation chặn ở DTO trước khi vào tới logic SM2.

**🆕 Testing chi tiết Wishlist:**

- 🆕 Integration Test: double-click giả lập bằng 2 request `POST /wishlist/toggle` gửi gần như đồng thời cho cùng 1 course — kết quả cuối cùng phải nhất quán (toggle 2 lần = về trạng thái ban đầu, không tạo 2 record hoặc lỗi unique constraint văng ra ngoài không kiểm soát).

**🆕 Testing chi tiết Notification (Event-Driven — đây là pattern kiến trúc quan trọng nhất của Phase 4):**

- 🆕 **Integration Test xác nhận tách rời đúng kiến trúc Event-Driven (bắt buộc, đây là cách duy nhất chứng minh hiểu đúng pattern, không chỉ "có dùng EventEmitter2"):** Viết test cố ý cho `NotificationListener` throw lỗi (mock để giả lập listener bị lỗi), sau đó gọi `CoursesService.approve()` → **assert luồng approve() vẫn chạy thành công và course chuyển trạng thái `published` đúng**, dù việc tạo Notification thất bại hoàn toàn. Đây chính là Done Criteria đã có trong bản gốc, nhưng plan gốc thiếu hướng dẫn _cách viết test_ để verify — bổ sung ở đây.
- 🆕 Unit Test: emit event `course.approved` → `NotificationListener` tạo đúng 1 Notification với `userId` là giáo viên sở hữu course đó (không phải admin vừa approve).

**Files tạo ra / sửa:** (giữ nguyên theo plan gốc) + 🆕 `src/modules/flashcards/tests/sm2-algorithm.spec.ts`, 🆕 `src/modules/wishlist/tests/wishlist-toggle.integration.spec.ts`, 🆕 `src/modules/notifications/tests/event-decoupling.integration.spec.ts`

**Commit message mẫu:** `feat(flashcard): implement spaced repetition, wishlist and event-driven notification system`

### 🆕 EXPLAIN-BACK CHECKPOINT — PHASE 4 (Bắt buộc)

Trả lời không nhìn code, ghi vào `docs/checkpoints/phase4-explain.md`:

1. Giải thích "The Timezone Trap" bằng ví dụ số liệu cụ thể của riêng bạn (giờ UTC, giờ VN, ngày bị lệch) — không lặp lại ví dụ 06:00 sáng trong plan gốc.
2. Tại sao SM2 giới hạn `easinessFactor` tối thiểu 1.3? Nếu không có giới hạn này, điều gì xảy ra với một học viên liên tục trả lời sai nhiều lần?
3. Lợi ích thật của Event-Driven (EventEmitter2) so với gọi trực tiếp `notificationService.create()` ngay trong `CoursesService.approve()` là gì? Có đánh đổi (trade-off) nào không, hay chỉ toàn lợi ích?
4. Wishlist toggle "idempotent" nghĩa là gì trong trường hợp cụ thể này? Nếu không xử lý idempotent, double-click sẽ gây ra hậu quả gì (mô tả cụ thể bằng dữ liệu DB, không chỉ nói chung "bị lỗi").
5. Nếu phải thêm tính năng "nhắc nhở học viên qua email khi sắp mất streak" vào kiến trúc hiện tại, bạn sẽ tích hợp nó vào Event-Driven system này như thế nào mà không sửa code của `StreakService`?

**Done criteria:**

- [ ] SM2: điểm 1 → ôn lại ngày hôm sau; điểm 5 → giãn cách tăng dần thông minh.
- [ ] Notification tạo qua Event Listener, verify bằng test "listener lỗi nhưng luồng chính vẫn chạy".
- [ ] `git tag v0.4.0-learning-engine` thành công.
- [ ] 🆕 Toàn bộ Test Suite Phase 4 pass 100%, coverage `streak`, `flashcards`/SM2 ≥ 85%.
- [ ] 🆕 File `docs/checkpoints/phase4-explain.md` hoàn thành.

---

# PHASE 5: PRODUCTION DEVOPS, HIGH-AVAILABILITY CI/CD & LIVE DEPLOYMENT (Day 161–205)

> Ghi chú dịch ngày: Phase gốc Day 156-200, dịch lùi 5 ngày. Nội dung kỹ thuật giữ nguyên 100%.

**Milestone:** Dockerfile Multi-Stage siêu nhẹ, GitHub Actions CI/CD, Sentry, backup script tự động.

> 🆕 **Lưu ý quan trọng cho Phase 5:** Đây là Phase mà toàn bộ Test Suite đã viết từ Phase 1-4 (ước tính 150-250 test case nếu làm đầy đủ theo Testing Strategy Master) sẽ được đưa vào CI pipeline chạy tự động. Nếu các Phase trước làm tắt phần test, Phase 5 sẽ lộ rõ ngay — CI sẽ đỏ liên tục. Đây chính là lý do testing phải làm nghiêm túc từ Day 1, không phải "để dồn vào buffer phase".

---

## Day 161–163 — Multi-Stage Dockerfile Tối ưu Siêu nhẹ

**Mục tiêu ngày:** Dockerfile chia tầng Multi-Stage, dung lượng ảnh dưới 200MB.

**Việc cần làm:**

- Dockerfile 2 stage: `builder` (cài full deps, build TS→JS), `runner` (Node Alpine, chỉ `npm ci --only=production`).
- Copy `dist` từ builder sang runner, xóa cache.
- `USER node` — không chạy root.
- `.dockerignore` loại trừ `node_modules` cục bộ.
- 🆕 **Bổ sung: Dockerfile cho môi trường test riêng** (`Dockerfile.test`) dùng trong CI — stage này giữ devDependencies để chạy Jest, khác với production image đã strip hết dev tools.

**Files tạo ra / sửa:** `Dockerfile`, `.dockerignore`, 🆕 `Dockerfile.test`

**Bug hay gặp & Góc nhìn System:**

- Dockerfile đơn tầng phình to 1-1.5GB do ôm cả dev tools. Chạy root trong container là lỗ hổng RCE chí mạng nếu bị khai thác.

**Commit message mẫu:** `chore: setup multi-stage dockerfile for optimized production image`

**Done criteria:**

- [ ] `docker build -t leoxora-api:latest .` thành công.
- [ ] `docker image ls` xác nhận dung lượng dưới 200MB.

---

## Day 164–169 — CI/CD Pipeline GitHub Actions

**Mục tiêu ngày:** Tự động chạy test, lint, và deploy khi push lên `main`.

**Việc cần làm:**

- `.github/workflows/ci-cd.yml`.
- Trigger: `push`/`pull_request` vào `main`.
- Service container PostgreSQL + Redis độc lập cho CI.
- Steps: `npm run lint`, `npm run test:cov`.
- Deploy job chỉ chạy sau khi test job pass.
- 🆕 **Bổ sung bước chạy đầy đủ 3 tầng test trong CI, không chỉ Unit Test** (đây là điểm hầu hết CI pipeline của intern làm thiếu — chỉ chạy `jest` mặc định mà quên Integration/E2E cần Testcontainers/DB thật):
  ```yaml
  - name: Run Unit Tests
    run: npm run test
  - name: Run Integration Tests
    run: npm run test:integration # cần service container postgres + redis đã khai báo ở bước trên
  - name: Run E2E Tests
    run: npm run test:e2e
  - name: Generate Coverage Report
    run: npm run test:cov
  - name: Check Coverage Threshold # 🆕 fail CI nếu coverage tụt dưới target đã đặt ở Testing Strategy Master
    run: npx jest --coverage --coverageThreshold='{"global":{"branches":75,"functions":80,"lines":80,"statements":80}}'
  ```
- 🆕 Thêm bước `healthcheck` đợi Postgres/Redis sẵn sàng (`pg_isready`) trước khi chạy test, tránh lỗi connection refused do container chưa kịp khởi động (đã cảnh báo ở mục "Bug hay gặp" bên dưới).

**Files tạo ra / sửa:** `.github/workflows/ci-cd.yml`

**Bug hay gặp & Góc nhìn System:**

- Luồng CI sập ở bước test DB do thiếu Healthcheck cho container service. Container DB cần vài giây khởi tạo, Node.js kết nối vội sẽ bị từ chối.

**Commit message mẫu:** `ci: add github actions workflow for test and deploy`

**Done criteria:**

- [ ] Push code mới → GitHub Actions chạy đầy đủ, tích xanh hoàn thành.
- [ ] 🆕 CI fail (đúng như mong đợi) nếu coverage tụt dưới threshold đã cấu hình — tự test bằng cách tạm comment 1 file test để xác nhận CI bắt được.

---

## Day 170–180 — Sentry & Centralized Logging

**Mục tiêu ngày:** Bắt lỗi 500 thời gian thực, cảnh báo qua Slack/Discord.

**Việc cần làm:**

- Đăng ký Sentry.io, lấy DSN.
- Cài đặt: `npm install @sentry/node @sentry/profiling-node`.
- Khởi tạo Sentry đầu file `main.ts`.
- `HttpExceptionFilter`: chỉ gửi lỗi ≥ 500 lên Sentry, không gửi 400/401/404.
- 🆕 **Bổ sung Observability tầng Business (Audit Log) — phần còn thiếu hoàn toàn ở bản gốc:** Tạo `AuditLogModule` ghi lại các hành động nhạy cảm vào bảng `audit_logs` riêng (không phải Sentry, đây là log nghiệp vụ không phải log lỗi kỹ thuật):
  - Admin approve/reject course (ai, lúc nào, course nào, lý do gì).
  - Payment status chuyển đổi (ai trigger, IPN hay manual).
  - User role thay đổi (nếu có tính năng này).

  Lý do bổ sung: Sentry chỉ bắt lỗi _kỹ thuật_ (code sập). Một hệ thống có dòng tiền chảy qua (Phase 3) bắt buộc phải có khả năng trả lời câu hỏi nghiệp vụ "ai đã approve course này lúc nào" mà không cần lỗi xảy ra — đây là yêu cầu compliance tối thiểu, không phải tính năng nâng cao.

- 🆕 Unit Test cho `AuditLogModule`: gọi `approve()` → assert có đúng 1 record audit log được tạo với đầy đủ `actorId`, `action`, `targetId`, `timestamp`.
- 🆕 Integration Test Sentry filter: cố tình throw lỗi 500 (chia cho 0 không được catch, hoặc gọi biến undefined) trong môi trường test với Sentry SDK mock (dùng `nock` chặn HTTP call thật tới Sentry) → assert Sentry capture được gọi đúng 1 lần; lỗi 404 → assert Sentry **không** được gọi.

**Files tạo ra / sửa:** `src/main.ts`, `src/common/filters/http-exception.filter.ts`, 🆕 `src/modules/audit-log/audit-log.module.ts`, 🆕 `src/modules/audit-log/audit-log.service.ts`, 🆕 `src/modules/audit-log/entities/audit-log.entity.ts`, 🆕 `src/modules/audit-log/audit-log.service.spec.ts`

**Bug hay gặp & Góc nhìn System:**

- Gửi tất cả lỗi (cả 401, 404) lên Sentry sẽ spam tin nhắn, che khuất lỗi nghiêm trọng thật, cạn quota miễn phí. Chỉ gửi lỗi 500 thật.

**Commit message mẫu:** `chore(logging): integrate sentry for real-time production error tracking and add business audit log`

**Done criteria:**

- [ ] Lỗi 500 cố ý → xuất hiện trên Sentry Dashboard.
- [ ] 🆕 Audit log ghi đúng khi Admin approve/reject course — verify bằng Integration Test, query trực tiếp bảng `audit_logs`.

---

## Day 181–190 — Load Testing (K6)

**Mục tiêu ngày:** Giả lập tải cao, tìm ngưỡng giới hạn, tối ưu Connection Pool.

**Việc cần làm:**

- Cài K6.
- Script `scripts/load-test.js`: tăng dần VU từ 10 → 500 trong 5 phút.
- Target `/courses`.
- Thu thập `http_req_duration p95`, error rate.
- Điều chỉnh `extra: { max: 50 }` trong `database.config.ts`.
- 🆕 **Bổ sung: Load test riêng cho API nhạy cảm concurrency đã test ở Phase 3** — chạy K6 nhắm vào `/payments/vnpay-ipn` với 50 VU gửi đồng thời cùng `orderId` (mô phỏng thật tình huống "cổng thanh toán retry dồn dập" được cảnh báo ở Phase 3, nhưng lần này ở quy mô tải cao, không chỉ 5 request như Integration Test). Đây là cách xác nhận SERIALIZABLE transaction vẫn đứng vững dưới tải thật, không chỉ dưới điều kiện test nhỏ.
- 🆕 Lưu kết quả K6 vào `docs/performance/phase5-load-test-report.md` kèm số liệu p95, error rate, và DB connection pool usage tại thời điểm tải cao nhất.

**Files tạo ra / sửa:** `src/config/database.config.ts`, `scripts/load-test.js`, 🆕 `scripts/load-test-ipn.js`, 🆕 `docs/performance/phase5-load-test-report.md`

**Bug hay gặp & Góc nhìn System:**

- Connection Pool Exhaustion: pool nhỏ (mặc định 10) gây nghẽn dưới tải cao, request xếp hàng, timeout. Tăng pool hợp lý kết hợp Index đã làm ở Phase 2.

**Commit message mẫu:** `perf(tuning): optimize database connection pool configurations based on load test results`

**Done criteria:**

- [ ] K6 báo cáo ổn định ở 200 VU, p95 < 200ms, error rate 0%.
- [ ] 🆕 Load test IPN dưới tải 50 VU đồng thời vẫn giữ đúng invariant: 1 Enrollment/orderId, không nhân bản (đây là bằng chứng cuối cùng, ở quy mô gần thật, cho toàn bộ công sức testing concurrency đã làm từ Phase 3).

---

## Day 191–205 — Backup Script, README & Bàn giao Sản phẩm

**Mục tiêu:** Backup DB tự động định kỳ; README chuẩn mã nguồn mở; bàn giao live.

**Việc cần làm:**

- Script bash `pg_dump`, nén `.tar.gz`, đặt tên kèm timestamp.
- CronJob 02:00 sáng hàng ngày.
- README.md: ERD, hướng dẫn setup 1 lệnh Docker, link API docs, tài khoản demo.
- Final UAT theo Master Security Checklist.
- Tag `v1.0.0-production`.
- 🆕 **Bổ sung mục Testing vào README** — một README "production-grade" thật phải có section riêng giải thích cách chạy test cho người review sau này (giáo viên hướng dẫn, nhà tuyển dụng xem code):
  ```markdown
  ## Testing

  - Unit tests: `npm run test` (coverage target: xem TESTING_STRATEGY.md)
  - Integration tests: `npm run test:integration` (yêu cầu Docker chạy Testcontainers)
  - E2E tests: `npm run test:e2e`
  - Coverage report: `npm run test:cov` → mở `coverage/lcov-report/index.html`
  - Xem chi tiết chiến lược test theo từng module tại `docs/TESTING_STRATEGY.md`
  ```
- 🆕 Test thử script backup bằng cách **giả lập khôi phục thật**: chạy `pg_dump` → xóa toàn bộ DB test → `pg_restore` từ file backup → verify dữ liệu khôi phục đúng 100% (đếm số row mỗi bảng trước/sau). Backup mà không test khôi phục là backup không đáng tin — đây là sai lầm vận hành rất phổ biến.

**Files tạo ra / sửa:** `README.md`, `scripts/backup-db.sh`, 🆕 `docs/TESTING_STRATEGY.md` (đúc kết lại toàn bộ Testing Strategy Master ở đầu file này thành tài liệu riêng dễ tham chiếu)

**Commit message mẫu:** `docs(release): complete comprehensive production readme file and database backup scripts`

### 🆕 EXPLAIN-BACK CHECKPOINT — PHASE 5 (Cuối cùng, tổng kết toàn bộ 205 ngày)

Đây là checkpoint quan trọng nhất — không chỉ về Phase 5 mà tổng hợp toàn bộ dự án. Ghi vào `docs/checkpoints/phase5-final-explain.md`:

1. Trong toàn bộ 5 Phase, đâu là quyết định kỹ thuật bạn **tự tin nhất** rằng mình hiểu sâu, có thể giải thích cho một Senior thật mà không cần mở code? Tại sao?
2. Đâu là quyết định kỹ thuật bạn **kém tự tin nhất** — vẫn làm theo đúng hướng dẫn của plan nhưng nếu bị hỏi "tại sao không làm cách khác" thì sẽ lúng túng? Ghi thật, đây không phải câu hỏi để được khen.
3. Nếu được giao lại dự án này từ đầu, bạn sẽ thay đổi gì trong **kiến trúc** (không phải chi tiết nhỏ) dựa trên những gì đã học được khi làm xong?
4. Tổng coverage thật của dự án (lấy từ `npm run test:cov` cuối cùng) là bao nhiêu? Module nào thấp nhất, vì sao?
5. Nếu một Senior hỏi bạn "phần nào trong dự án này rủi ro nhất nếu đưa vào production thật với tiền thật, dù bạn đã test đầy đủ theo plan" — bạn sẽ trả lời gì? (Gợi ý: đáp án đúng không phải "không có rủi ro gì" — luôn có giới hạn nào đó mà testing trong phạm vi dự án cá nhân không thể che hết, ví dụ: chưa test với traffic thật đa vùng địa lý, chưa test khi VNPay thật trả lỗi mạng giữa transaction, v.v. Tự suy nghĩ ra ít nhất 2 giới hạn thật của riêng dự án bạn.)

**Done criteria:**

- [ ] Backup script chạy thủ công, file nén hợp lệ > 0KB.
- [ ] 🆕 Test khôi phục từ backup thành công, dữ liệu khớp 100%.
- [ ] `git tag v1.0.0-production` thành công.
- [ ] 🆕 File `docs/checkpoints/phase5-final-explain.md` hoàn thành đầy đủ 5 câu — đây là điều kiện cuối cùng để coi dự án "hoàn thành đúng nghĩa", không chỉ "code chạy được".

---

# PHỤ LỤC TỔNG HỢP: BẢNG KIỂM TRA CHẤT LƯỢNG CUỐI PHẦN

## Bảng Kiểm tra Phase 1 (Foundation & Auth)

- [ ] JWT Access Token ≤ 15 phút, Refresh Token ≤ 7 ngày.
- [ ] RTR phát hiện và xóa sạch session khi có token cũ gian lận.
- [ ] OTP qua Mailtrap, chặn tài khoản chưa xác thực đăng nhập.
- [ ] Rate Limiting chặn > 5 lần login/phút/IP.
- [ ] Avatar update tự xóa ảnh cũ trên Cloudinary.
- [ ] Không API nào trả `passwordHash`.
- [ ] 🆕 Coverage `auth`/`refresh-token`/`users` ≥ 85%, đo thật bằng `test:cov`.
- [ ] 🆕 Checkpoint `phase1-explain.md` hoàn thành.

## Bảng Kiểm tra Phase 2 (Course Marketplace)

- [ ] BOLA bị triệt tiêu hoàn toàn (Giáo viên A không sửa được course B).
- [ ] `contentUrl` ẩn với học viên chưa mua.
- [ ] Admin chặn approve course rỗng (0 lesson).
- [ ] Tìm kiếm + phân trang tối ưu bằng Composite Index.
- [ ] Unique constraint chặn review trùng.
- [ ] Quiz/Listening/Reading không rò rỉ đáp án trước khi nộp.
- [ ] ADR Listening/Reading scoring đã ghi nhận.
- [ ] 🆕 Coverage `courses`/`lessons`/`reviews`/`listening`/`reading` ≥ 80%.
- [ ] 🆕 Integration Test BOLA, content-protection, rating-concurrency đều pass trên DB thật.
- [ ] 🆕 Checkpoint `phase2-explain.md` hoàn thành.

## Bảng Kiểm tra Phase 3 (Payment & Transaction)

- [ ] Webhook IPN xác thực chữ ký nghiêm ngặt, từ chối nếu sai lệch.
- [ ] Idempotency: gọi trùng 3 lần chỉ xử lý 1 lần.
- [ ] SERIALIZABLE Transaction triệt tiêu Race Condition khi nhiều IPN dồn về.
- [ ] Course `price == 0` bỏ qua hoàn toàn bước VNPay.
- [ ] Coupon `usedCount` tăng an toàn dưới Pessimistic Lock, không vượt `maxUses`.
- [ ] 🆕 Coverage `payments` module ≥ 90% (cao nhất trong toàn dự án, do rủi ro tài chính).
- [ ] 🆕 Integration Test concurrency (5 IPN đồng thời, 10 coupon request đồng thời) pass trên DB thật, không phải mock.
- [ ] 🆕 Checkpoint `phase3-explain.md` hoàn thành, câu 1 có diagram timeline thật.

## Bảng Kiểm tra Phase 4 (Learning Engine)

- [ ] % tiến độ an toàn tuyệt đối trước chia cho 0.
- [ ] Streak: tối thiểu 8/8 kịch bản test pass (không phải 5/5 như bản gốc).
- [ ] SM2 tính đúng `nextReviewAt` theo công thức khoa học, `easinessFactor` không dưới 1.3.
- [ ] Notification tạo qua Event Listener — verify bằng test "listener lỗi, luồng chính vẫn chạy".
- [ ] Wishlist toggle idempotent dưới double-click.
- [ ] 🆕 Coverage `progress`/`streak`/`flashcards` ≥ 85%.
- [ ] 🆕 Checkpoint `phase4-explain.md` hoàn thành.

## Bảng Kiểm tra Phase 5 (DevOps & Production)

- [ ] Docker image < 200MB.
- [ ] Container chạy bằng `USER node`, không root.
- [ ] CI/CD chặn deploy nếu Unit Test fail.
- [ ] 🆕 CI/CD chạy đủ 3 tầng test (Unit + Integration + E2E), không chỉ Unit.
- [ ] 🆕 CI có Coverage Threshold check, tự fail nếu coverage tụt.
- [ ] Sentry chỉ thu thập lỗi 500 thật.
- [ ] 🆕 Audit Log ghi đầy đủ hành động nhạy cảm (approve/reject course, payment status change).
- [ ] 🆕 Backup script đã test khôi phục thật, không chỉ test tạo file.
- [ ] 🆕 Checkpoint `phase5-final-explain.md` hoàn thành — điều kiện cuối để coi dự án hoàn thành đúng nghĩa.

---

# 🆕 PHỤ LỤC: TEMPLATE FILE ADR (Architecture Decision Record)

Dùng file này làm mẫu cho mọi quyết định kiến trúc trong `docs/decisions/`:

```markdown
# ADR-XXX: [Tên quyết định]

## Bối cảnh

[Vấn đề cần giải quyết là gì? Tại sao cần quyết định?]

## Các lựa chọn đã xét

### Lựa chọn A: [Tên]

- Ưu điểm:
- Nhược điểm:

### Lựa chọn B: [Tên]

- Ưu điểm:
- Nhược điểm:

## Quyết định cuối

[Chọn phương án nào]

## Lý do

[Tại sao chọn phương án này, đánh đổi gì đã chấp nhận]

## Ngày quyết định

[YYYY-MM-DD]
```

---

# TECHNICAL LEAD NOTE: TÀI LIỆU CẦN CHUẨN BỊ TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

Trước khi mở IDE, chuẩn bị đầy đủ 5 tài liệu nền tảng (Figma/Miro/Notion/Draw.io):

1. **ERD toàn diện**: `users`, `courses`, `lessons`, `payments`, `enrollments`, `reviews`, `placement_questions`, `lesson_progress`, `flashcards`, `listening_exercises`, `reading_passages`, `wishlists`, `coupons`, `notifications`, 🆕 `audit_logs`. Thể hiện rõ kiểu dữ liệu, index, FK, `onDelete` behavior.

2. **API RESTful Design Specification**: Notion hoặc Postman Collection khung sườn — method, DTO payload, query params phân trang, yêu cầu phân quyền, response mẫu thành công/lỗi.

3. **Environment Configuration Matrix**: Bảng biến môi trường 3 nhóm (Dev/Test/Production), giải thích công dụng, giá trị mẫu an toàn.

4. **Architecture & Naming Convention Guide**: Quy chuẩn đặt tên file/class/cột DB xuyên suốt dự án.

5. **🆕 Testing Strategy Document** (`docs/TESTING_STRATEGY.md`): Đúc kết phần Testing Strategy Master ở đầu file này — coverage target từng module, danh sách Integration Test bắt buộc, công cụ sử dụng (Testcontainers, nock, K6). Đây là tài liệu thứ 5 bổ sung so với bản gốc 4 tài liệu — lý do: một dự án claim "production-grade" mà không có tài liệu test thống nhất từ đầu sẽ dẫn đến tình trạng mỗi module test theo phong cách khác nhau, không nhất quán.

6. **File `docs/decisions/` (ADR)**: Ghi lại mọi quyết định kiến trúc có trade-off thật theo template ở trên — biến tài liệu từ "lộ trình học" thành "tài sản kỹ thuật" thật của dự án.
