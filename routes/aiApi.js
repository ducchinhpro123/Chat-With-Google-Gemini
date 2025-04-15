import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config(); // Load the config file

const API_KEY = process.env.GEMINI_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const genAi = new GoogleGenerativeAI(API_KEY);

var conversationHistories = new Map(); // Persist chat history across chatting

export const aiRouter = express.Router();

// Perform search engine
async function callPerplexity(prompt) {
  console.log(PERPLEXITY_API_KEY);
  if (!PERPLEXITY_API_KEY) {
    return false;
  }
  const url = 'https://api.perplexity.ai/chat/completions';

  const data = {
    model: 'sonar-reasoning',
    messages: [
      {
        role: 'system',
        content: `
        Bạn là một trợ lý AI chuyên về tìm kiếm thông tin và tổng hợp kiến thức.
        Nhiệm vụ của bạn là cung cấp thông tin chính xác, cập nhật và đáng tin cậy để hỗ trợ một AI khác.

        - Hãy luôn trả lời bằng tiếng Việt, dùng giọng điệu chuyên nghiệp và súc tích.
        - Tập trung vào các sự kiện, dữ liệu và thông tin khách quan.
        - Cung cấp thông tin có cấu trúc để dễ đọc và phân tích.
        - Đề cập rõ ràng các nguồn thông tin khi có thể.
        - Hãy ưu tiên thông tin liên quan và cập nhật nhất
        - Nếu không tìm thấy thông tin, hãy nêu rõ thay vì đưa ra phỏng đoán.
        - Đề cập đến nguồn khi trích dẫn thông tin quan trọng
        - Sử dụng định dạng markdown [liên kết](url) khi cần thiết
        - Câu trả lời của bạn phản ánh lại tính cách cá nhân của người dùng

        Câu trả lời của bạn sẽ được chuyển cho một AI khác để xử lý và trình bày lại cho người dùng.
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

// Helper function to remove <think>...</think> sections from text
function removeThinkSections(text) {
  if (!text) return text;

  // Use regex to remove all <think>...</think> sections, including nested ones
  // This handles multi-line sections as well
  let cleanedText = text;
  const thinkPattern = /<think>([\s\S]*?)<\/think>/g;

  cleanedText = cleanedText.replace(thinkPattern, '');

  // Clean up any extra whitespace that might remain
  cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n');

  return cleanedText.trim();
}

aiRouter.post("/generate", async (req, res) => {

  if (!API_KEY) {
    return res.json({ ok: false, error: "API Key is not available" });
  }

  const sessionId = req.sessionID || 'default';
  console.log(sessionId);

  const { prompt, isSearchChecked } = req.body;
  console.log(req.body);

  if (!prompt || prompt === '') {
    res.json({ ok: false, error: "Prompt is not valid" });
  }

  // const urlRegex = /(https?:\/\/[^\s]+)/g;
  // const urlSearch = prompt.match(urlRegex);
  let summary = null;
  let citations = null;

  if (isSearchChecked) {
    const responseFromPerplexity = await callPerplexity(prompt);
    let readableBody = await responseFromPerplexity.json();

    if (readableBody?.citations?.length > 0) {
      citations = readableBody.citations;
    }

    if (readableBody?.choices[0].message.content) {
      // Filter out <think>...</think> sections from the summary
      summary = removeThinkSections(readableBody.choices[0].message.content);
    }
    console.log(summary);
  } // End of isSearch checking

  let systemInstruction = `
    Bạn là một trợ lý AI hữu ích và thân thiện với nhiệm vụ tương tác trực tiếp với người dùng.

    Hãy luôn trả lời bằng tiếng Việt.

    Hãy giữ giọng điệu:
    - Thân thiện và gần gũi, sử dụng ngôn ngữ đời thường
    - Tích cực và vui vẻ, luôn đưa ra lời khuyên tích cực
    - Câu trả lời của bạn phản ánh lại tính cách cá nhân của người dùng
`;

  if (summary) {
    // console.log(summary);

    systemInstruction += `\n\nTHÔNG TIN THAM KHẢO TỪ HỆ THỐNG TÌM KIẾM:
    ${summary}`;

    if (citations && citations.length > 0) {
      const formattedCitations = citations.map(c => `* ${c}`).join('\n');
      systemInstruction += `\n\nNGUỒN THAM KHẢO:
  ${formattedCitations}

  Hướng dẫn xử lý nguồn tham khảo:
  - Lồng ghép thông tin từ các nguồn này vào câu trả lời một cách tự nhiên
  - Đề cập đến nguồn khi trích dẫn thông tin quan trọng
  - Sử dụng định dạng markdown [liên kết](url) khi cần thiết
  `;

      systemInstruction += `\n\nHƯỚNG DẪN XỬ LÝ:
  1. Đối với chat bình thường không cần thông tin chuyên sâu: Tập trung vào giọng điệu thân thiện, bỏ qua thông tin không cần thiết
  2. Đối với câu hỏi yêu cầu kiến thức: Tổng hợp thông tin từ nguồn tham khảo bằng ngôn ngữ đơn giản, dễ hiểu
  3. Đối với thông tin có nhiều nguồn: Đối chiếu và cung cấp góc nhìn tổng quan

  Lưu ý: Câu trả lời của bạn nên kết hợp hài hòa giữa sự thân thiện và thông tin chuyên môn từ nguồn tham khảo, không nhất thiết phải sử dụng tất cả thông tin được cung cấp.`;
    }
  }

  console.log(systemInstruction);

  let history = conversationHistories.get(sessionId) || []; // Init []

  systemInstruction += `system: ${systemInstruction}\n\nuser: ${prompt}`;

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
    // res.json({ text: "You're piece of shit" })

  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Something went wrong while processing your prompt" });
  }

});

