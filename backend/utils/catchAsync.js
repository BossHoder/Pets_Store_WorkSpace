const catchAsync = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next); // Đẩy lỗi cho global error handler
    };
};
module.exports = catchAsync;