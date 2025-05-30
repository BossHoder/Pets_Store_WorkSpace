const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Bảo vệ routes, kiểm tra user đã đăng nhập chưa
exports.protect = catchAsync(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }


    if (!token) {
        return next(new AppError('Bạn chưa đăng nhập, vui lòng đăng nhập để tiếp tục.', 401));
    }

    try {
        // Xác thực token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const currentUser = await User.findById(decoded.id);

        if (!currentUser) {
            return next(new AppError('Người dùng của token này không còn tồn tại.', 401));
        }

        // Gắn thông tin user vào request
        req.user = currentUser;
        next();
    } catch (err) {
        return next(new AppError('Token không hợp lệ hoặc đã hết hạn.', 401));
    }
});

// Kiểm tra vai trò người dùng
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(
                new AppError(`Vai trò (${req.user.role}) của bạn không được phép truy cập tài nguyên này.`, 403)
            );
        }
        next();
    };
};