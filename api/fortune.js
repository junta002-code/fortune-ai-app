const ZODIAC = {
  "おひつじ座": 0,
  "おうし座": 30,
  "ふたご座": 60,
  "かに座": 90,
  "しし座": 120,
  "おとめ座": 150,
  "てんびん座": 180,
  "さそり座": 210,
  "いて座": 240,
  "やぎ座": 270,
  "みずがめ座": 300,
  "うお座": 330
};

function normalizeAngle(deg) {
  return ((deg % 360) + 360) % 360;
}

function angularDistance(a, b) {
  const d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(d, 360 - d);
}

function sinDeg(deg) {
  return Math.sin(deg * Math.PI / 180);
}

function cosDeg(deg) {
  return Math.cos(deg * Math.PI / 180);
}

function atan2Deg(y, x) {
  return Math.atan2(y, x) * 180 / Math.PI;
}

// 外部の天文ライブラリを使わず、太陽・月の黄経を近似計算する。
// 今回の占い用途では、日々の位置関係を安定して取得することを優先する。
function getSunMoonLongitude(date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451543.5;

  // 太陽
  const sunW = 282.9404 + 0.0000470935 * d;
  const sunM = 356.0470 + 0.9856002585 * d;
  const sunEcc = 0.016709 - 0.000000001151 * d;
  const sunE = sunM + (180 / Math.PI) * sunEcc * sinDeg(sunM) * (1 + sunEcc * cosDeg(sunM));
  const sunX = cosDeg(sunE) - sunEcc;
  const sunY = Math.sqrt(1 - sunEcc * sunEcc) * sinDeg(sunE);
  const sunV = atan2Deg(sunY, sunX);
  const sunLongitude = normalizeAngle(sunV + sunW);

  // 月の軌道要素
  const moonN = 125.1228 - 0.0529538083 * d;
  const moonI = 5.1454;
  const moonW = 318.0634 + 0.1643573223 * d;
  const moonA = 60.2666;
  const moonEcc = 0.0549;
  const moonM = 115.3654 + 13.0649929509 * d;

  const sunLongitudeMean = normalizeAngle(sunM + sunW);
  const moonLongitudeMean = normalizeAngle(moonM + moonW);

  // 月の主要な摂動を簡易的に反映
  const ev = 1.2739 * sinDeg(2 * (moonLongitudeMean - sunLongitudeMean) - moonM);
  const ae = 0.1858 * sinDeg(sunM);
  const a3 = 0.37 * sinDeg(sunM);
  const moonM1 = moonM + ev - ae - a3;
  const ec = 6.2886 * sinDeg(moonM1);
  const a4 = 0.214 * sinDeg(2 * moonM1);
  const a5 = 0.11 * sinDeg(moonLongitudeMean - sunLongitudeMean);
  const moonM2 = moonM1 + ec - a4 + a5;

  const moonE = moonM2 + (180 / Math.PI) * moonEcc * sinDeg(moonM2) * (1 + moonEcc * cosDeg(moonM2));
  const moonR = moonA * (1 - moonEcc * cosDeg(moonE));
  const moonV = atan2Deg(
    Math.sqrt(1 - moonEcc * moonEcc) * sinDeg(moonE),
    cosDeg(moonE) - moonEcc
  );

  const u = moonW + moonV;
  const nRad = moonN * Math.PI / 180;
  const iRad = moonI * Math.PI / 180;
  const uRad = u * Math.PI / 180;

  const xh = moonR * (Math.cos(nRad) * Math.cos(uRad) - Math.sin(nRad) * Math.sin(uRad) * Math.cos(iRad));
  const yh = moonR * (Math.sin(nRad) * Math.cos(uRad) + Math.cos(nRad) * Math.sin(uRad) * Math.cos(iRad));

  let moonLongitude = normalizeAngle(atan2Deg(yh, xh));

  // 主要な追加補正
  moonLongitude +=
    -0.17 * sinDeg(moonN)
    -0.34 * sinDeg(2 * moonLongitudeMean - 2 * sunLongitudeMean)
    +0.66 * sinDeg(2 * moonLongitudeMean);

  moonLongitude = normalizeAngle(moonLongitude);

  return {
    sunLongitude,
    moonLongitude
  };
}

// 太陽・月と選択星座の位置関係だけで内部的な傾向を作る。
// これは占いのルールであり、科学的な因果関係を示すものではない。
function aspectScore(distance) {
  const aspects = [
    { angle: 0, score: 12 },
    { angle: 60, score: 8 },
    { angle: 90, score: -7 },
    { angle: 120, score: 8 },
    { angle: 180, score: -10 }
  ];

  let best = { score: 0, difference: Infinity };

  for (const aspect of aspects) {
    const difference = Math.abs(distance - aspect.angle);
    if (difference < best.difference) {
      best = { score: aspect.score, difference };
    }
  }

  if (best.difference >= 30) return 0;
  return best.score * (1 - best.difference / 30);
}

function buildZodiacSkyData(zodiac, date) {
  const signStart = ZODIAC[zodiac];
  const signCenter = normalizeAngle(signStart + 15);
  const { sunLongitude, moonLongitude } = getSunMoonLongitude(date);

  const sunDistance = angularDistance(sunLongitude, signCenter);
  const moonDistance = angularDistance(moonLongitude, signCenter);

  const sunScore = aspectScore(sunDistance);
  const moonScore = aspectScore(moonDistance);
  const skyScore = Math.round(sunScore * 0.45 + moonScore * 0.55);

  let tendency;
  if (skyScore >= 8) tendency = "追い風";
  else if (skyScore >= 2) tendency = "やや追い風";
  else if (skyScore <= -8) tendency = "慎重";
  else if (skyScore <= -2) tendency = "やや慎重";
  else tendency = "穏やか";

  return {
    zodiac,
    sunLongitude: Number(sunLongitude.toFixed(2)),
    moonLongitude: Number(moonLongitude.toFixed(2)),
    zodiacCenterLongitude: Number(signCenter.toFixed(2)),
    sunDistance: Number(sunDistance.toFixed(2)),
    moonDistance: Number(moonDistance.toFixed(2)),
    skyScore,
    tendency
  };
}

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

  if (!Object.prototype.hasOwnProperty.call(ZODIAC, zodiac)) {
    return res.status(400).json({
      error: "星座の選択内容が正しくありません。"
    });
  }

  const now = new Date();

  const today = now.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  });

  const japanTime = now.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const sky = buildZodiacSkyData(zodiac, now);

  const prompt = `
あなたは「AIトリプル占い」の占い師です。

今回は、星座占い部分を実装する第1段階です。
「太陽・月・選択された星座」の3要素だけを使って、「今日の運勢」の文章を作ってください。

重要：
- 天体の位置計算はプログラム側ですでに行っています。
- 下記の数値を材料として使ってください。
- 血液型と直感マークは、今回は星座占いの文章には一切使わないでください。
- 結果文章の中で選択した星座名を直接書かないでください。
- 「占星術では〜」などの説明も不要です。
- 占いとして楽しく読める文章にしてください。
- 1〜2文、70〜100文字程度の自然な日本語にしてください。
- 「今日の運勢＝」という見出しはプログラム側で付けます。
- 同じ星座でも月は時間とともに動くため、占う時刻によって少し違う表現になって構いません。

今日：${today}
日本時間：${japanTime}

選択された星座：${sky.zodiac}
選択された星座の中心黄経：${sky.zodiacCenterLongitude}度
太陽の黄経：${sky.sunLongitude}度
月の黄経：${sky.moonLongitude}度
太陽と星座中心の角距離：${sky.sunDistance}度
月と星座中心の角距離：${sky.moonDistance}度
内部運勢傾向：${sky.tendency}
内部運勢スコア：${sky.skyScore}

出力はJSONオブジェクトだけにしてください。
Markdownのコードブロックや前後の説明文は付けないでください。

{
  "zodiacFortune": "今日の運勢の文章",
  "luckyColor": "",
  "luckyItem": "",
  "markGrade": "",
  "totalScore": 0
}

今回変更するのは zodiacFortune だけです。
luckyColor、luckyItem、markGrade、totalScore は空欄または0のままにしてください。
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
      fortune,
      zodiacSky: sky
    });
  } catch (error) {
    console.error("Fortune server error:", error);
    return res.status(500).json({
      error: "VercelからGeminiへの通信処理でエラーが発生しました。",
      detail: error.message
    });
  }
}
