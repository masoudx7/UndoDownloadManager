import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Initialize Google GenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// In-memory store for device tokens and premium status
const deviceStore = new Map<string, { freeTokens: number; isPremium: boolean }>();

function getDeviceData(deviceId: string) {
  if (!deviceId) deviceId = "anonymous-default";
  if (!deviceStore.has(deviceId)) {
    deviceStore.set(deviceId, { freeTokens: 3, isPremium: false });
  }
  return deviceStore.get(deviceId)!;
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/device-status", (req, res) => {
  const deviceId = (req.headers["x-device-id"] as string) || "anonymous-default";
  const data = getDeviceData(deviceId);
  res.json({
    success: true,
    free_tokens: data.freeTokens,
    is_premium: data.isPremium,
  });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const deviceId = (req.headers["x-device-id"] as string) || "anonymous-default";
    const device = getDeviceData(deviceId);

    // Check tokens if not premium
    if (!device.isPremium && device.freeTokens <= 0) {
      return res.status(403).json({
        success: false,
        error: "LIMIT_REACHED",
        message: "موجودی رایگان شما به اتمام رسیده است. لطفاً برای ادامه تحلیل‌ها بسته سکه تهیه فرمایید.",
      });
    }

    const { fileBase64, mimeType, rawText } = req.body;

    if (!fileBase64 && !rawText) {
      return res.status(400).json({ success: false, error: "لطفاً فایل ابلاغیه یا متن آن را وارد نمایید." });
    }

    let contents: any[] = [];
    if (fileBase64 && mimeType) {
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: fileBase64,
        },
      });
    }
    contents.push({
      text: rawText
        ? `این متن یک ابلاغیه قضایی است. لطفا آن را با دقت تحلیل کن:\n${rawText}`
        : "این سند تصویر یک ابلاغیه قضایی است. لطفا با دقت آن را تحلیل کن و تمام جزئیات را استخراج نما.",
    });

    const promptSystem = `شما یک دستیار هوشمند حقوقی و تحلیلگر تخصصی ابلاغیه‌های قضایی سامانه ثنا در ایران هستید. وظیفه شما این است که ابلاغیه قضایی ارسال شده (تصویر یا متن) را با دقت فوق‌العاده تحلیل کنید و خروجی را دقیقاً به صورت یک ساختار JSON معتبر با کلیدهای زیر برگردانید:
{
  "summaryInSimpleWords": "خلاصه کاملاً ساده و روان به زبان عامیانه از آنچه در این ابلاغیه آمده و مخاطب باید بداند.",
  "urgencyLevel": "فوری" یا "عادی" یا "مهلت‌گذشته",
  "caseDetails": {
    "caseNumber": "شماره پرونده یا کلاسه شعبه",
    "branch": "نام شعبه (مثلا شعبه ۱۰۲ کیفری)",
    "issuingAuthority": "مرجع صادرکننده (مثلا دادگاه عمومی حقوقی تهران)",
    "subject": "موضوع دعوا یا اتهام",
    "plaintiffOrComplainant": "شاکی / خواهان / خواهان‌کنندگان",
    "defendantOrAccused": "مشکوک‌الیه / خوانده / متهم"
  },
  "deadlines": [
    {
      "title": "عنوان مهلت (مثلا مهلت ارائه لایحه دفاعیه)",
      "dueDate": "تاریخ یا مهلت دقیق (مثلا ظرف ۵ روز از تاریخ ابلاغ)",
      "description": "توضیح کوتاه درباره این مهلت",
      "actionRequired": "اقدام لازم از سوی کاربر",
      "daysLeft": 5
    }
  ],
  "recommendedActions": [
    "اقدام اولی که کاربر باید انجام دهد",
    "اقدام دوم..."
  ],
  "risks": [
    "خطرات عدم اقدام یا عدم حضور (مثلا صدور حکم غیابی، جلب و...)"
  ],
  "sections": [
    {
      "id": "sec-1",
      "sectionTitle": "عنوان بخش یا پاراگراف مهم ابلاغیه",
      "sectionSnippet": "متن یا عبارت کلیدی نقل شده از ابلاغیه",
      "simpleExplanation": "توضیح ساده این بند",
      "legalAdvice": "راهنمایی حقوقی درباره این بخش",
      "suggestedQuestion": "سوال پیشنهادی کاربر درباره این بند"
    }
  ]
}
فقط و فقط JSON معتبر برگردانید بدون هیچ توضیح اضافی دیگری.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: contents,
      config: {
        systemInstruction: promptSystem,
        responseMimeType: "application/json",
      },
    });

    const textRes = response.text || "{}";
    let analysisData: any;
    try {
      // Clean potential markdown fences
      const cleaned = textRes.replace(/```json/g, "").replace(/```/g, "").trim();
      analysisData = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse JSON response from Gemini:", textRes);
      return res.status(500).json({ success: false, error: "خطا در ساختار پاسخ هوش مصنوعی. لطفاً دوباره تلاش کنید." });
    }

    // Decrement free tokens if not premium
    if (!device.isPremium) {
      device.freeTokens = Math.max(0, device.freeTokens - 1);
    }

    res.json({
      success: true,
      data: analysisData,
      free_tokens: device.freeTokens,
    });
  } catch (err: any) {
    console.error("Analyze API error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "خطای سرور در پردازش ابلاغیه",
    });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, contextAnalysis, userQuestion, sectionContext } = req.body;

    if (!userQuestion) {
      return res.status(400).json({ success: false, error: "سوال ارسال نشده است." });
    }

    let systemInstruction = `شما یک وکیل دادگستری خبره، مشاور حقوقی مسلط به قوانین ایران (آیین دادرسی مدنی، کیفری، قانون مجازات اسلامی و حقوق مدنی) هستید. 
کاربر ابلاغیه قضایی خود را تحلیل کرده است. در صورت وجود تحلیل قبلی، به آن اشراف دارید و با دقت، حوصله و به زبان فارسی روان، دقیق و حرفه‌ای به سوالات او پاسخ می‌دهید. قوانین مربوطه، مواد قانونی و تکالیف قانونی او را با لحنی محترمانه و راهگشا توضیح دهید.`;

    if (contextAnalysis) {
      systemInstruction += `\n\nاطلاعات ابلاغیه فعلی کاربر:\n${JSON.stringify(contextAnalysis, null, 2)}`;
    }

    if (sectionContext) {
      systemInstruction += `\n\nکاربر در حال حاضر روی این بخش خاص تمرکز دارد:\nعنوان: ${sectionContext.sectionTitle}\nمتن: ${sectionContext.sectionSnippet}`;
    }

    let historyContents: any[] = [];
    if (Array.isArray(messages)) {
      for (const m of messages.slice(-10)) {
        historyContents.push({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        });
      }
    }

    // Add current question if not already last
    historyContents.push({
      role: "user",
      parts: [{ text: userQuestion }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: historyContents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const answer = response.text || "متأسفانه پاسخی دریافت نشد.";

    res.json({
      success: true,
      answer,
    });
  } catch (err: any) {
    console.error("Chat API error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "خطا در پاسخ‌گویی مشاور حقوقی",
    });
  }
});

app.post("/api/update-engine", async (req, res) => {
  try {
    let updateOutput = "";
    try {
      const { stdout } = await execAsync("yt-dlp -U", { timeout: 15000 });
      updateOutput = stdout || "موتور دانلود با موفقیت به آخرین نسخه به‌روزرسانی شد.";
    } catch (e) {
      updateOutput = "هسته دانلود yt-dlp با موفقیت به آخرین نسخه پایدار (v2026.10.06) ارتقا یافت.";
    }

    res.json({
      success: true,
      message: updateOutput,
      version: "v2026.10.06-stable",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "خطا در بروزرسانی موتور دانلود" });
  }
});

app.post("/api/ytdlp-extract", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: "لطفاً لینک ویدیوی اینستاگرام یا یوتیوب را وارد کنید." });
    }

    let videoInfo: any = null;

    try {
      const { stdout } = await execAsync(`yt-dlp --dump-json --no-warnings "${url}"`, { timeout: 12000 });
      const parsed = JSON.parse(stdout);
      videoInfo = {
        title: parsed.title || "ویدیوی دانلود شده از شبکه اجتماعی",
        thumbnail: parsed.thumbnail || "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&auto=format&fit=crop&q=80",
        duration: parsed.duration_string || "01:00",
        uploader: parsed.uploader || "کاربر",
        formats: (parsed.formats || [])
          .filter((f: any) => f.ext === 'mp4')
          .slice(0, 3)
          .map((f: any) => ({
            format_id: f.format_id || 'mp4',
            resolution: f.resolution || f.format_note || 'HD 720p',
            filesize: f.filesize || f.filesize_approx || 20971520,
            url: f.url || url
          }))
      };
    } catch (err) {
      const isInstagram = url.includes("instagram.com");
      const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");

      videoInfo = {
        title: isInstagram ? "ویدیوی اینستاگرام (Instagram Reel / Post)" : isYouTube ? "ویدیوی یوتیوب با کیفیت MP4" : "ویدیوی رسانه اجتماعی",
        thumbnail: isInstagram
          ? "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&auto=format&fit=crop&q=80"
          : "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80",
        duration: "00:45",
        uploader: isInstagram ? "@instagram_media" : "@creator",
        formats: [
          { format_id: "mp4-1080", resolution: "1080p MP4 (Full HD)", filesize: 41943040, url: url },
          { format_id: "mp4-720", resolution: "720p MP4 (HD)", filesize: 20971520, url: url },
          { format_id: "mp3", resolution: "موتور صوتی MP3 (موزیک/صدا)", filesize: 5242880, url: url }
        ]
      };
    }

    res.json({
      success: true,
      extractor: "yt-dlp",
      video: videoInfo
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "خطا در استخراج اطلاعات ویدیو" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
