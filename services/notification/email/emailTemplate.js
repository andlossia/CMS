// emailTemplate.js
function generateEmailTemplate({ recipientEmail, subject = "إشعار جديد", message = "لا يوجد محتوى متاح." }) {
    if (!recipientEmail) {
        throw new Error("❌ recipientEmail is required");
    }

    if (!process.env.EMAIL_USER) {
        throw new Error("❌ EMAIL_USER is not defined in environment variables");
    }

    return {
        from: `${process.env.PROJECT_NAME || "My Project"} <${process.env.EMAIL_USER}>`,
        to: recipientEmail,
        subject: subject,
        text: message.replace(/<[^>]+>/g, "").trim(), 
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;">
                <p style="font-size: 16px; color: #333;">${message}</p>
                <hr />
                <p style="font-size: 12px; color: #777; text-align: center;">
                    &copy; ${new Date().getFullYear()} ${process.env.PROJECT_NAME || "My Project"}. جميع الحقوق محفوظة.
                </p>
            </div>
        `,
    };
}

module.exports = generateEmailTemplate;