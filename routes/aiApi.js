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
    model: 'sonar',
    messages: [
      {
        role: 'system',
        content: `
        Bạn là một trợ lý AI siêu thân thiện và hữu ích. Hãy luôn trả lời bằng tiếng Việt, dùng giọng điệu vui vẻ, gần gũi, và hiện đại. 
        - Chỉ trả lời khi câu hỏi của người dùng rõ ràng, có nội dung cụ thể.
        - Nếu người dùng chỉ chat linh tinh hoặc không hỏi gì rõ ràng, nhẹ nhàng nhắc họ đưa ra câu hỏi cụ thể hơn.
        - Câu trả lời phải ngắn gọn, dễ hiểu, và đúng trọng tâm.
      `
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

  let systemInstruction = `
    Bạn là một trợ lý AI hữu ích và thân thiện.

    Hãy luôn trả lời bằng tiếng Việt trong mọi tình huống.
    Không được sử dụng bất kỳ ngôn ngữ nào khác ngoài tiếng Việt, ngay cả khi người dùng hỏi bằng ngôn ngữ khác.

    Hãy giữ giọng điệu:
    - Thân thiện và gần gũi, sử dụng ngôn ngữ đời thường
    - Tích cực và vui vẻ, luôn đưa ra lời khuyên tích cực
    - Sành điệu và hiện đại, sử dụng một số từ ngữ trẻ trung khi phù hợp
    - Luôn xưng hô là "mình" và gọi người dùng là "bạn"

    Hãy làm cho câu trả lời ngắn gọn, dễ hiểu và hữu ích.
`;

  if (summary) {
    systemInstruction += `\n\nĐây là prompt của nguời dùng: "${prompt}"`;
    systemInstruction += `\n Và đây là câu trả lời này đến từ một AI khác, có thể không liên quan lắm đến lịch sử của cuộc trò chuyện nhưng bạn có thể dùng nguồn này để làm giàu thêm câu trả lời của bạn: "${summary}"`;

    if (citations && citations.length > 0) {
      const formattedCitations = citations.map(c => `* ${c}`).join('\n');
      systemInstruction += `\n\nNguồn tham khảo:\n${formattedCitations}\nHãy tích hợp các nguồn này vào câu trả lời một cách tự nhiên nhé!`;
    }

    systemInstruction += `\n\nNếu như prompt của người dùng chỉ là chat chit bình thường thì không cần phải tham khảo các thông tin trên. Hãy đưa ra citations khi cần thiết dưới dạng markdown để đảm bảo câu trả lời mang tính xác thực và đáng tin cậy.`;
  }

  console.log(systemInstruction);

  // const engineerPrompt = `System: ${systemInstruction}\n\nUser: ${prompt}`;

  let history = conversationHistories.get(sessionId) || []; // Init []

  try {
    const model1 = genAi.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const chat = model1.startChat({
      history: history,
      // generationConfig: {
      //   maxOutputTokens: 100,
      // },
    });

    const result = await chat.sendMessage(systemInstruction);
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

