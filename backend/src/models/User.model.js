const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const addressSchema = new mongoose.Schema({
    street: { type: String, required: [true, 'Vui lòng nhập tên đường'] },
    city: { type: String, required: [true, 'Vui lòng nhập thành phố'] },
    postalCode: { type: String, required: [true, 'Vui lòng nhập mã bưu điện'] },
    country: { type: String, required: [true, 'Vui lòng nhập quốc gia'], default: 'Việt Nam' },
    contactName: { type: String },
    contactPhone: { type: String },
    isDefault: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Vui lòng nhập tên của bạn'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Vui lòng nhập email của bạn'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Vui lòng nhập địa chỉ email hợp lệ',
        ],
    },
    password: {
        type: String,
        required: [true, 'Vui lòng nhập mật khẩu'],
        minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự'],
        select: false, // Không tự động trả về trường password khi query
    },
    phoneNumber: {
        type: String,
        // required: [true, 'Vui lòng nhập số điện thoại'], // Cân nhắc có bắt buộc hay không
        trim: true,
    },
    role: {
        type: String,
        enum: ['buyer', 'seller', 'admin'],
        default: 'buyer',
    },
    avatarUrl: {
        type: String,
        default: 'https://example.com/default-avatar.png' // URL ảnh đại diện mặc định
    },
    addresses: [addressSchema],
    isEmailVerified: {
        type: Boolean,
        default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    status: {
        type: String,
        enum: ['active', 'suspended', 'pending_verification'],
        default: 'active',
    },
    lastLoginAt: Date,
}, {
    timestamps: true, // Tự động thêm createdAt và updatedAt
});

// Middleware: Mã hóa mật khẩu trước khi lưu
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method: So sánh mật khẩu đã nhập với mật khẩu đã hash trong DB
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Method: Tạo JSON Web Token
userSchema.methods.getSignedJwtToken = function () {
    return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

// Method: Tạo và hash token đặt lại mật khẩu
userSchema.methods.getPasswordResetToken = function () {
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token và lưu vào DB
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Đặt thời gian hết hạn (ví dụ: 10 phút)
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

    return resetToken; // Trả về token chưa hash để gửi cho user
};


const User = mongoose.model('User', userSchema);
module.exports = User;