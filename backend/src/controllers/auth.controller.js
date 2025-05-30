const User = require('../models/User.model');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

// Hàm helper để gửi token response
const sendTokenResponse = (user, statusCode, res, message = 'Thành công') => {
    const token = user.getSignedJwtToken();

    const cookieOptions = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000), // 30 ngày
        httpOnly: true, // Cookie không thể được truy cập bởi JavaScript phía client
    };

    if (process.env.NODE_ENV === 'production') {
        cookieOptions.secure = true; // Chỉ gửi cookie qua HTTPS
    }

    // Loại bỏ mật khẩu khỏi output
    const userOutput = { ...user.toObject() };
    delete userOutput.password;
    delete userOutput.passwordResetToken;
    delete userOutput.passwordResetExpires;
    delete userOutput.emailVerificationToken;
    delete userOutput.emailVerificationExpires;


    res.status(statusCode)
        .json({
            success: true,
            message,
            token, // Gửi token trong response body
            data: { user: userOutput },
        });
};

// @desc    Đăng ký người dùng mới
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = catchAsync(async (req, res, next) => {
    const { name, email, password, phoneNumber } = req.body;

    // Kiểm tra xem email đã tồn tại chưa
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return next(new AppError('Email này đã được sử dụng.', 400));
    }

    const user = await User.create({
        name,
        email,
        password,
        phoneNumber,
        role: 'buyer'
    });

    sendTokenResponse(user, 201, res, 'Đăng ký tài khoản thành công.');
});

// @desc    Đăng nhập người dùng
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    // Kiểm tra email và password có được cung cấp không
    if (!email || !password) {
        return next(new AppError('Vui lòng cung cấp email và mật khẩu.', 400));
    }

    // Tìm user bằng email, và lấy cả trường password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        return next(new AppError('Email hoặc mật khẩu không đúng.', 401));
    }

    // Kiểm tra mật khẩu
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
        return next(new AppError('Email hoặc mật khẩu không đúng.', 401));
    }
    
    // Cập nhật lastLoginAt
    user.lastLoginAt = Date.now();
    await user.save({ validateBeforeSave: false });


    sendTokenResponse(user, 200, res, 'Đăng nhập thành công.');
});

// @desc    Đăng xuất người dùng
// @route   POST /api/auth/logout
// @access  Private (cần token để biết ai logout, hoặc không cần nếu chỉ client xóa token)
exports.logoutUser = catchAsync(async (req, res, next) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
    });

    res.status(200).json({
        success: true,
        message: 'Đăng xuất thành công.',
        data: {},
    });
});

// @desc    Lấy thông tin người dùng hiện tại
// @route   GET /api/auth/me
// @access  Private
exports.getMe = catchAsync(async (req, res, next) => {
    // req.user đã được gắn bởi middleware `protect`
    const user = await User.findById(req.user.id); // Lấy lại user để có thông tin mới nhất (tùy chọn)

    if (!user) {
        return next(new AppError('Không tìm thấy người dùng.', 404));
    }
    
    // Loại bỏ mật khẩu và các token nhạy cảm
    const userOutput = { ...user.toObject() };
    delete userOutput.password;
    delete userOutput.passwordResetToken;
    delete userOutput.passwordResetExpires;
    delete userOutput.emailVerificationToken;
    delete userOutput.emailVerificationExpires;

    res.status(200).json({
        success: true,
        data: { user: userOutput },
    });
});


// @desc    Yêu cầu đặt lại mật khẩu
// @route   POST /api/auth/request-password-reset
// @access  Public
exports.requestPasswordReset = catchAsync(async (req, res, next) => {
    const { email } = req.body;
    if (!email) {
        return next(new AppError('Vui lòng cung cấp địa chỉ email.', 400));
    }

    const user = await User.findOne({ email });

    if (!user) {
         return res.status(200).json({ success: true, message: 'Nếu email của bạn tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.' });
    }

    // Tạo reset token
    const resetToken = user.getPasswordResetToken();
    await user.save({ validateBeforeSave: false }); // Lưu token đã hash và thời gian hết hạn vào DB

    // Tạo URL reset (ví dụ: cho frontend)
    // Thay CLIENT_URL bằng URL của frontend page xử lý reset password
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    const message = `Bạn nhận được email này vì bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng truy cập URL sau để đặt lại mật khẩu:\n\n${resetUrl}\n\nNếu bạn không yêu cầu điều này, vui lòng bỏ qua email này. Link sẽ hết hạn sau 10 phút.`;

    try {
        await sendEmail({ // Hàm gửi email của bạn
            email: user.email,
            subject: 'Yêu cầu đặt lại mật khẩu Pet\'s Store',
            message,
        });
        console.log("GỬI EMAIL (GIẢ LẬP):"); // GIẢ LẬP GỬI EMAIL
        console.log("Đến:", user.email);
        console.log("Chủ đề: Yêu cầu đặt lại mật khẩu Pet's Store");
        console.log("Nội dung:", message);
        console.log("Token chưa hash (để test):", resetToken);


        res.status(200).json({ success: true, message: 'Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn.' });
    } catch (err) {
        console.error('Lỗi gửi email:', err);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
        return next(new AppError('Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại.', 500));
    }
});


// @desc    Đặt lại mật khẩu
// @route   POST /api/auth/reset-password
// @access  Public (Token là bằng chứng truy cập)
exports.resetPassword = catchAsync(async (req, res, next) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return next(new AppError('Vui lòng cung cấp token và mật khẩu mới.', 400));
    }

    // Hash token nhận được từ client để so sánh với token đã hash trong DB
    const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }, // Token còn hạn
    });

    if (!user) {
        return next(new AppError('Token không hợp lệ hoặc đã hết hạn.', 400));
    }

    // Đặt mật khẩu mới
    user.password = newPassword; // Sẽ được hash bởi pre-save hook
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    // user.passwordChangedAt = Date.now(); // Nếu bạn có trường này
    await user.save();

    // Đăng nhập user luôn sau khi reset thành công (tùy chọn)
    // sendTokenResponse(user, 200, res, 'Đặt lại mật khẩu thành công và đã đăng nhập.');
    res.status(200).json({ success: true, message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập với mật khẩu mới.' });
});