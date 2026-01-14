import { Resend } from "resend";
import Busboy from "busboy";

export const config = {
  api: {
    bodyParser: false, // REQUIRED for Busboy
  },
};

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // ---------------------------
  // CORS
  // ---------------------------
  res.setHeader("Access-Control-Allow-Origin", "https://cinedot.in");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const fields = {};
    const attachments = [];

    // ---------------------------
    // Parse multipart form
    // ---------------------------
    await new Promise((resolve, reject) => {
      const busboy = Busboy({ headers: req.headers });

      busboy.on("field", (name, value) => {
        fields[name] = value;
      });

      busboy.on("file", (name, file, info) => {
        const { filename } = info;
        let buffer = Buffer.alloc(0);

        file.on("data", (data) => {
          buffer = Buffer.concat([buffer, data]);
        });

        file.on("end", () => {
          if (buffer.length > 0) {
            attachments.push({
              filename,
              content: buffer.toString("base64"),
            });
          }
        });
      });

      busboy.on("finish", resolve);
      busboy.on("error", reject);

      req.pipe(busboy);
    });

    const { name, email, phone, message } = fields;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ---------------------------
    // SEND EMAIL (CINEDOT DESIGN)
    // ---------------------------
    await resend.emails.send({
      from: "Cinedot Contact <onboarding@resend.dev>",
      to: "info@cinedot.in",
      replyTo: email,
      subject: "📩 New Contact Form Submission — Cinedot",
      html: `
        <div style="background:#09090b;padding:40px 20px;font-family:Arial;">
          <div style="
            max-width:600px;
            margin:auto;
            background:#18181b;
            border:1px solid rgba(220,38,38,.35);
            border-radius:16px;
            padding:32px;
            color:#ffffff;
          ">
            <h1 style="letter-spacing:3px;margin:0">CONTACT REQUEST</h1>
            <div style="width:60px;height:2px;background:#dc2626;margin:16px 0"></div>

            <p><strong>NAME</strong><br/>${name}</p>
            <p><strong>EMAIL</strong><br/>${email}</p>
            <p><strong>PHONE</strong><br/>${phone || "N/A"}</p>

            <p><strong>MESSAGE</strong></p>
            <div style="
              background:#09090b;
              padding:16px;
              border-radius:12px;
              margin-top:8px;
            ">
              ${message.replace(/\n/g, "<br/>")}
            </div>

            <p style="
              margin-top:32px;
              font-size:11px;
              color:#71717a;
              text-align:center;
              letter-spacing:2px;
            ">
              CINEDOT • NEW FORM SUBMISSION
            </p>
          </div>
        </div>
      `,
      attachments,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Email API Error:", error);
    return res.status(500).json({ error: "Email sending failed" });
  }
}
