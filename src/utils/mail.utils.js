import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    pool: true,
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465", // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sendOTPEmail = async (email, otp) => {
    try {
        const mailOptions = {
            from: `"StreamFlix Support" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Your StreamFlix OTP Verification Code",
            html: `
                <div style="font-family: Helvetica, Arial, sans-serif; min-width: 1000px; overflow: auto; line-height: 2">
                    <div style="margin: 50px auto; width: 70%; padding: 20px 0">
                        <div style="border-bottom: 1px solid #eee">
                            <a href="" style="font-size: 1.4em; color: #06b6d4; text-decoration: none; font-weight: 600">StreamFlix</a>
                        </div>
                        <p style="font-size: 1.1em">Hi,</p>
                        <p>Thank you for choosing StreamFlix. Use the following OTP to complete your authentication process. OTP is valid for 10 minutes.</p>
                        <h2 style="background: #06b6d4; margin: 0 auto; width: max-content; padding: 0 10px; color: #fff; border-radius: 4px;">${otp}</h2>
                        <p style="font-size: 0.9em;">Regards,<br />StreamFlix Team</p>
                        <hr style="border: none; border-top: 1px solid #eee" />
                        <div style="float: right; padding: 8px 0; color: #aaa; font-size: 0.8em; line-height: 1; font-weight: 300">
                            <p>StreamFlix Inc</p>
                        </div>
                    </div>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("OTP email sent successfully: %s", info.messageId);
        return true;
    } catch (error) {
        console.error("Error sending OTP email:", error);
        return false;
    }
};
