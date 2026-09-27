export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }

  const apiKey = process.env.FORTUNE_AI_APP_GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY_TEST がVercelに設定されていません。"
    });
  }

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
          contents: [
            {
              parts: [
                {
                  text: "「Gemini接続成功」とだけ日本語で返してください。"
                }
              ]
            }
          ]
        })
      }
    );

    const bodyText = await response.text();

    if (!response.ok) {
      console.error("Gemini test error:", response.status, bodyText);
      return res.status(502).json({
        error: "Gemini APIがエラーを返しました。",
        geminiStatus: response.status,
        detail: bodyText
      });
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch {
      return res.status(502).json({
        error: "GeminiからJSONとして解釈できない応答が返りました。"
      });
    }

    const message =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!message) {
      return res.status(502).json({
        error: "Geminiからテキスト応答を取得できませんでした。",
        raw: data
      });
    }

    return res.status(200).json({
      ok: true,
      message
    });
  } catch (error) {
    console.error("Gemini test server error:", error);
    return res.status(500).json({
      error: "VercelからGeminiへの通信処理でエラーが発生しました。",
      detail: error.message
    });
  }
}
