import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config(); // Load the config file

const API_KEY = process.env.GEMINI_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const genAi = new GoogleGenerativeAI(API_KEY);

var conversationHistories = new Map();[] // Persist chat history across chatting

export const aiRouter = express.Router();

// Perform search engine
async function callPerplexity(prompt) {
  if (!PERPLEXITY_API_KEY) {
    return false;
  }
  const url = 'https://api.perplexity.ai/chat/completions';

  const data = {
    model: 'sonar-reasoning',
    messages: [
      {
        role: 'system',
        content: 'Be precise and concise. Always put the newest news up to date first.'
      },
      {
        role: 'user',
        content: prompt
      },
    ]
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${await response.text()}`);
    }

    return response;

  } catch (e) {
    console.error(e);
  }

}

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

  // const urlRegex = /(https?:\/\/[^\s]+)/g;
  // const urlSearch = prompt.match(urlRegex);
  let summary = null;
  let citations = null;

  const responseFromPerplexity = await callPerplexity(prompt);
  let readableBody = await responseFromPerplexity.json();

  if (readableBody?.citations?.length > 0) {
    citations = readableBody.citations;
  }

  if (readableBody?.choices[0].message.content) {
    summary = readableBody.choices[0].message.content;
  }

  // let systemInstruction = "You"
  let systemInstruction = "Bạn ơi, nhiệm vụ của bạn là trở thành người bạn tâm tình, luôn kề bên và giúp đỡ nha. Luôn trả lời bằng tiếng Việt, dùng markdown cho đẹp nè. Hãy nói chuyện thật tình cảm, mùi mẫn, như đang tâm sự với người bạn thân thiết nhất vậy đó. Miễn là bạn thực sự giúp được người ta và giữ sự chân thành nhé.";

  if (summary) {
    systemInstruction = systemInstruction.concat(`\n\nBạn có thể dùng nguồn này để làm giàu thêm câu trả lời của bạn, lưu ý chỉ khi nào người dùng hỏi về câu hỏi nào đó mà cần thông tin thôi, còn không thì bạn không càn tham khảo nguồn này nhé: ${summary}`);

    if (citations) {
      systemInstruction = systemInstruction.concat(`\n\n:Và đây là citations được trả về: ${citations.join(', ')}. Bạn nhớ format lại markdown và trả lời lại cho người dùng nhé!`);
    }
  }

  console.log(systemInstruction);

  const engineerPrompt = `${systemInstruction}\n\nUser: ${prompt}`;

  let history = conversationHistories.get(sessionId) || []; // Init []

  try {
    const model1 = genAi.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const chat = model1.startChat({
      history: history,
      // generationConfig: {
      //   maxOutputTokens: 100,
      // },
    });

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

