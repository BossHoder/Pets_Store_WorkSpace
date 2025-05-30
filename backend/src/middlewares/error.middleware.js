const AppError = require('../utils/AppError');

const handleCastErrorDB = (err) => {
    const message = `Giá trị không hợp lệ ${err.path}: ${err.value}.`;
    return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
    // Trích xuất giá trị bị trùng từ thông báo lỗi (cần tùy chỉnh theo lỗi cụ thể)
    const value = err.errmsg ? err.errmsg.match(/(["'])(\\?.)*?\1/)[0] : Object.values(err.keyValue)[0];
    const message = `Giá trị trường bị trùng: ${value}. Vui lòng sử dụng giá trị khác.`;
    return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Dữ liệu đầu vào không hợp lệ. ${errors.join('. ')}`;
    return new AppError(message, 400);
};

const handleJWTError = () => new AppError('Token không hợp lệ. Vui lòng đăng nhập lại.', 401);
const handleJWTExpiredError = () => new AppError('Token đã hết hạn. Vui lòng đăng nhập lại.', 401);


const sendErrorDev = (err, res) => {
    console.error('LỖI 💣', err);
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack,
    });
};

const sendErrorProd = (err, res) => {
    // A) Lỗi có thể dự đoán được, gửi thông báo cho client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        });
    // B) Lỗi lập trình hoặc lỗi không xác định: không rò rỉ chi tiết lỗi
    } else {
        // 1) Log lỗi
        console.error('LỖI 💣 (Không thể dự đoán)', err);
        // 2) Gửi thông báo chung chung
        res.status(500).json({
            status: 'error',
            message: 'Đã có lỗi xảy ra phía server!',
        });
    }
};


module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else if (process.env.NODE_ENV === 'production') {
        let error = { ...err }; // Tạo bản sao để không thay đổi err gốc
        error.message = err.message; // Quan trọng để giữ lại message gốc

        if (error.name === 'CastError') error = handleCastErrorDB(error);
        if (error.code === 11000) error = handleDuplicateFieldsDB(error); // Lỗi trùng key
        if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
        if (error.name === 'JsonWebTokenError') error = handleJWTError();
        if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
        
        sendErrorProd(error, res);
    }
};