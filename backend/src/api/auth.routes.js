const express = require('express');
const {
    registerUser,
    loginUser,
    logoutUser,
    getMe,
    requestPasswordReset,
    resetPassword,
} = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Middleware kiểm tra lỗi validation
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Lấy lỗi đầu tiên để hiển thị (hoặc bạn có thể gửi tất cả lỗi)
        const firstError = errors.array({ onlyFirstError: true })[0].msg;
        return res.status(400).json({ success: false, message: firstError });
        // Hoặc: return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

router.post(
    '/register',
    [
        body('name', 'Tên không được để trống').notEmpty().trim(),
        body('email', 'Vui lòng nhập email hợp lệ').isEmail().normalizeEmail(),
        body('password', 'Mật khẩu phải có ít nhất 6 ký tự').isLength({ min: 6 }),
        body('phoneNumber', 'Số điện thoại không hợp lệ (tùy chọn)')
            .optional({ checkFalsy: true }) // Cho phép trống hoặc null
            .isMobilePhone('vi-VN') // Kiểm tra SĐT Việt Nam (có thể cần tùy chỉnh regex nếu muốn chặt chẽ hơn)
            .withMessage('Số điện thoại không đúng định dạng của Việt Nam.'),
    ],
    validate,
    registerUser
);

router.post(
    '/login',
    [
        body('email', 'Vui lòng nhập email hợp lệ').isEmail().normalizeEmail(),
        body('password', 'Mật khẩu không được để trống').notEmpty(),
    ],
    validate,
    loginUser
);

router.post('/logout', protect, logoutUser); // `protect` để đảm bảo user đã đăng nhập mới logout (tùy logic)

router.get('/me', protect, getMe);

router.post(
    '/request-password-reset',
    [
        body('email', 'Vui lòng nhập email hợp lệ').isEmail().normalizeEmail(),
    ],
    validate,
    requestPasswordReset
);

router.post(
    '/reset-password',
    [
        body('token', 'Token không được để trống').notEmpty(),
        body('newPassword', 'Mật khẩu mới phải có ít nhất 6 ký tự').isLength({ min: 6 }),
    ],
    validate,
    resetPassword
);

module.exports = router;