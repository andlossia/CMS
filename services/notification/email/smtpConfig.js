const nodemailer = require("nodemailer");

async function createTransporter() {
    try {
        return nodemailer.createTransport({
            service: "gmail",
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.CLIENT_SECRET,
            },
        });
    } catch (error) {
        console.error("❌ خطأ أثناء إعداد SMTP:", error);
        throw error;
    }
}

module.exports = createTransporter;
