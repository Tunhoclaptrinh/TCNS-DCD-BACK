export const validateForgotPasswordTarget = (req, res, next) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';

  if (!email && !phone) {
    return res.status(400).json({
      success: false,
      message: 'Email hoặc số điện thoại là bắt buộc',
    });
  }

  next();
};

export const mapNewPasswordField = (req, _res, next) => {
  // Chuẩn hóa payload để middleware validate hiện tại vẫn tái sử dụng được.
  if (typeof req.body?.newPassword === 'string' && !req.body.password) {
    req.body.password = req.body.newPassword;
  }

  next();
};
