# Swagger Auto-Generator — Hướng dẫn sử dụng

Hệ thống tự động sinh Swagger (OpenAPI 3.0) từ **routes**, **controllers**, **schemas** — không cần viết spec thủ công.

## Truy cập

- **Swagger UI**: `http://localhost:3000/api-docs`
- **JSON spec**: `http://localhost:3000/api-docs.json`

---

## 1. Tạo entity mới

### Bước 1: Tạo schema

```js
// schemas/product.schema.js
module.exports = {
  name: {
    type: "string",
    required: true,
    minLength: 2,
    maxLength: 200,
    description: "Tên sản phẩm",
  },
  price: {
    type: "number",
    required: true,
    min: 0,
    description: "Giá bán",
  },
  category: {
    type: "enum",
    enum: ["electronics", "clothing", "food"],
    required: true,
    description: "Danh mục",
  },
  inStock: {
    type: "boolean",
    default: true,
    description: "Còn hàng",
  },
};
```

**Các type hỗ trợ:** `string`, `number`, `boolean`, `email`, `date`, `enum`

### Bước 2: Đăng ký schema

```js
// schemas/index.js
module.exports = {
  users: require("./user.schema"),
  notifications: require("./notification.schema"),
  products: require("./product.schema"), // ← thêm dòng này
};
```

### Bước 3: Tạo route file

```js
// routes/product.routes.js
const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const { protect } = require("../middleware/auth.middleware");
const { checkPermission } = require("../middleware/rbac.middleware");
const { validateSchema } = require("../middleware/validation.middleware");

// Public
router.get("/", productController.getAll);
router.get("/:id", productController.getById);

// Protected
router.post(
  "/",
  protect,
  checkPermission("products:create"),
  validateSchema("product"),
  productController.create,
);

router.put(
  "/:id",
  protect,
  checkPermission("products:update"),
  productController.update,
);

router.delete(
  "/:id",
  protect,
  checkPermission("products:delete"),
  productController.delete,
);

module.exports = router;
```

### Bước 4: Đăng ký route

```js
// routes/index.js
router.use("/products", require("./product.routes"));
```

**Kết quả:** Swagger sẽ tự động tạo 5 endpoints với tag `Products`, schema đầy đủ.

---

## 2. Middleware tự động nhận diện

Swagger auto **tự phát hiện** middleware trong route và sinh docs tương ứng:

| Middleware                          | Swagger tự thêm                          |
| ----------------------------------- | ---------------------------------------- |
| `protect`                           | 🔒 `security: bearerAuth`                |
| `router.use(protect)`               | 🔒 Tất cả routes phía dưới đều protected |
| `authorize('admin')`                | Description: `🔒 Yêu cầu quyền: admin`   |
| `checkPermission('x:y')`            | Description: `🔑 Permission: x:y`        |
| `validateSchema('user')`            | `requestBody` = full schema Users        |
| `validateFields('user', ['email'])` | `requestBody` = chỉ field email          |
| `getUploadMiddleware(...)`          | `requestBody` = `multipart/form-data`    |

**Không cần config gì thêm** — chỉ cần dùng middleware trong route file.

---

## 3. JSDoc annotations (tuỳ chọn)

Nếu muốn **override** summary/tag/body mặc định, thêm JSDoc vào controller:

```js
/**
 * Tạo sản phẩm mới
 * @swagger.tag Products
 * @swagger.summary Tạo sản phẩm
 * @swagger.security bearerAuth
 * @swagger.body Products
 * @swagger.response 201 Tạo thành công
 * @swagger.response 400 Validation failed
 */
exports.create = async (req, res, next) => { ... };
```

**Các annotation hỗ trợ:**

| Annotation                     | Mô tả                       |
| ------------------------------ | --------------------------- |
| `@swagger.tag`                 | Gán tag (có thể nhiều dòng) |
| `@swagger.summary`             | Summary ngắn gọn            |
| `@swagger.security`            | Yêu cầu auth                |
| `@swagger.body SchemaName`     | Request body ref đến schema |
| `@swagger.response CODE mô tả` | Response code + description |

> **Lưu ý:** JSDoc là **tuỳ chọn**. Nếu không viết, hệ thống sẽ tự sinh summary thông minh.

### Hỗ trợ cả 2 kiểu controller

```js
// Kiểu 1: exports.method
/** @swagger.summary Đăng nhập */
exports.login = async (req, res, next) => { ... };

// Kiểu 2: class field
class UserController {
  /** @swagger.summary Danh sách users */
  getAll = async (req, res, next) => { ... };
}
```

---

## 4. Smart summary tự động

Khi **không có JSDoc**, hệ thống tự sinh summary theo pattern:

| Method + Path           | Summary tự động              |
| ----------------------- | ---------------------------- |
| `GET /`                 | Danh sách {Entity}           |
| `POST /`                | Tạo {Entity}                 |
| `GET /:id`              | Chi tiết {Entity}            |
| `PUT /:id`              | Cập nhật {Entity}            |
| `DELETE /:id`           | Xoá {Entity}                 |
| `PATCH /:id/status`     | Cập nhật trạng thái {Entity} |
| `DELETE /:id/permanent` | Xoá vĩnh viễn {Entity}       |
| `GET /stats/*`          | Thống kê {Entity}            |
| `GET /template`         | Tải template import {Entity} |
| `POST /import`          | Import {Entity} từ file      |
| `GET /export`           | Export {Entity}              |
| `PATCH /:id/read`       | Đánh dấu đã đọc              |
| `PATCH /read-all`       | Đánh dấu tất cả đã đọc       |

---

## 5. Cấu trúc file

```
project/
├── schemas/
│   ├── index.js          ← đăng ký schemas
│   ├── user.schema.js
│   └── product.schema.js
├── routes/
│   ├── index.js          ← mount paths (swagger đọc từ đây)
│   ├── user.routes.js
│   └── product.routes.js
├── controllers/
│   ├── user.controller.js
│   └── product.controller.js
├── utils/
│   └── swagger-auto.js   ← engine tự sinh swagger
└── server.js
```

**Quy tắc đặt tên:**

- Route file: `{entity}.routes.js`
- Controller file: `{entity}.controller.js`
- Controller variable trong route: `{entity}Controller` (ví dụ: `productController`)
