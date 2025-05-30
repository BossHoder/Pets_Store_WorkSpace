const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1) Create a transporter (service that will send email like "gmail", "sendgrid", "mailgun")
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
        },
        // secure: false, // true for 465, false for other ports
        // logger: true,
        // debug: true,
    });

    // 2) Define the email options
    const mailOptions = {
        from: process.env.EMAIL_FROM || '"Pet\'s Store" <noreply@petstore.example.com>',
        to: options.email,
        subject: options.subject,
        text: options.message, // Hoặc html: options.html
    };

    // 3) Actually send the email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;