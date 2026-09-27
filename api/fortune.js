export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const apiKey = process.env.FORTUNE_AI_APP_GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "FORTUNE_AI_APP_GEMINI_API_KEY がVercelに設定されていません。"
    });
  }

  const { zodiac, bloodType, mark } = req.body || {};

  if (!zodiac || !bloodType || !mark) {
    return res.status(400).json({
      error: "星座・血液型・直感マークをすべて選択してください。"
    });
  }

  const today = new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  });

  const prompt = `
あなたは「AIトリプル占い」の占い師です。
これは現段階の試作版です。占いの正式な計算方法や判定ルールは後の工程で決めます。
今回は、入力された情報をもとに、自然で楽しい今日の占い結果を作ってください。

今日の日付：${today}
星座：${zodiac}
血液型：${bloodType}
直感マーク：${mark}

JSONオブジェクトだけを返してください。Markdownのコードブロックや前後の説明文は付けないでください。

{
  "zodiacFortune": "星座についての短い今日の運勢",
  "luckyColor": "ラッキーカラー",
  "luckyItem": "ラッキーアイテム",
  "markGrade": "凶・小吉・吉・中吉・大吉のいずれか1つ",
  "totalScore": 0
}

totalScoreは0から100までの整数にしてください。
`;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const bodyText = await response.text();

    if (!response.ok) {
      console.error("Fortune Gemini error:", response.status, bodyText);
      return res.status(502).json({
        error: "Gemini APIが占い結果の生成に失敗しました。",
        geminiStatus: response.status,
        detail: bodyText
      });
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch {
      return res.status(502).json({
        error: "Gemini APIからJSONとして解釈できない応答が返りました。"
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      return res.status(502).json({
        error: "Geminiから占い結果を取得できませんでした。",
        raw: data
      });
    }

    const cleanedText = text
      .trim()
      .replace(/^\`\`\`json\s*/i, "")
      .replace(/^\`\`\`\s*/i, "")
      .replace(/\s*\`\`\`$/i, "")
      .trim();

    let fortune;
    try {
      fortune = JSON.parse(cleanedText);
    } catch {
      return res.status(502).json({
        error: "Geminiの占い結果をJSONとして解釈できませんでした。",
        raw: text
      });
    }

    return res.status(200).json({
      ok: true,
      fortune
    });
  } catch (error) {
    console.error("Fortune server error:", error);
    return res.status(500).json({
      error: "VercelからGeminiへの通信処理でエラーが発生しました。",
      detail: error.message
    });
  }
}
