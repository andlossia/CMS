const createTransporter = require("./smtpConfig");
const generateEmailTemplate = require("./emailTemplate");

async function sendEmail(recipientEmail, subject, message) {
    try {
        const transporter = await createTransporter();

        if (!transporter) {
            throw new Error("❌ Failed to create transporter");
        }

        const mailOptions = generateEmailTemplate({ recipientEmail, subject, message });

        if (!mailOptions || typeof mailOptions !== 'object') {
            throw new Error("❌ Invalid email template format");
        }

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully to ${recipientEmail}: ${info.response}`);
        return info;
    } catch (error) {
        console.error("❌ Error sending email:", error);
        throw error;
    }
}

module.exports = sendEmail;
