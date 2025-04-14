import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const genAi = new GoogleGenerativeAI(API_KEY);

var conversationHistories = new Map();[]

export const aiRouter = express.Router();

aiRouter.post("/generate", async (req, res) => {

  if (!API_KEY) {
    return res.json({ ok: false, error: "API Key is not available" });
  }

  const sessionId = req.sessionID || 'default';
  console.log(sessionId);

  const { prompt } = req.body;

  if (!prompt || prompt === '') {
    res.json({ ok: false, error: "Prompt is not valid" });
  }

  const systemInstruction = "Bạn ơi, nhiệm vụ của bạn là trở thành người bạn tâm tình, luôn kề bên và giúp đỡ nha. Luôn trả lời bằng tiếng Việt, dùng markdown cho đẹp nè. Hãy nói chuyện thật tình cảm, mùi mẫn, như đang tâm sự với người bạn thân thiết nhất vậy đó. Cứ thể hiện hết cảm xúc, hơi 'sến' một chút cũng được, miễn là bạn thực sự giúp được người ta và giữ sự chân thành nhé. Nói tục cũng chẳng thành vấn đề gì đâu, cứ thoải mái thôi.";

  const engineerPrompt = `${systemInstruction}\n\nUser: ${prompt}`;

  let history = conversationHistories.get(sessionId) || [];

  try {
    const model1 = genAi.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // const model = ai.model('gemini-2.0-flash');

    const chat = model1.startChat({
      history: history,
      // generationConfig: {
      //   maxOutputTokens: 100,
      // },
    });
    console.log(history);

    const result = await chat.sendMessage(engineerPrompt);
    const response = await result.response;
    const responseText = await response.text();

    history.push({ role: "user", parts: [{ text: prompt }] });
    history.push({ role: "model", parts: [{ text: responseText }] });

    conversationHistories.set(sessionId, history);

    res.json({ text: responseText });

  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Something went wrong while processing your prompt" });
  }

});

