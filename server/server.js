require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:3000',
  'https://bag-or-broke.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: false
}));

app.use(bodyParser.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is running!' });
});

app.post('/api/generate-summary', async (req, res) => {
  const playerData = req.body;

  const archetypeDescriptions = `
Archetypes:
- The Architect: Strategic, analytical, methodical planner; builds value quietly.
- The Legacy Maker: Impact-first, community-driven, cautious and consistent.
- The Hot Shot: Flashy, impulsive, starts strong but often struggles late-game.
- The Hustler: Relentless, street-smart, flips every loss, aggressive investor.
- The Survivor: Quiet underdog, faces many setbacks but shows resilience.
- The CEO in Training: Balanced, polished, invests wisely for the long-term.
- The Flexer: Status-driven, trendsetter, spends on luxury, weak financial discipline.
- The Flameout: High-risk, ego-driven, impulsive, often crashes out.
`;

  const prompt = `
You are an expert commentator for a NIL money simulation game. 
Given the following player data, select **the SINGLE archetype from the list below that best fits this player's playstyle**. 
Begin your response with "Archetype: [archetype name]" (exactly matching one from the list), then provide a rich, 5-6 sentence summary. 
- Reference the player by name.
- Highlight their signature moves, turning points, risks, and what set them apart.
- Mention their investments, luxury purchases, credit/debt, and how they handled curveballs.
- Conclude with an insight about their overall NIL journey and what made them unique in this game.
- Do NOT mention anything about yourself or the AI.

${archetypeDescriptions}

Player data:
${JSON.stringify(playerData, null, 2)}
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // or 'gpt-4o' if you have access
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 350,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (!data.choices || !data.choices[0]?.message?.content) {
      throw new Error(JSON.stringify(data));
    }
    const raw = data.choices[0].message.content.trim();

    // Parse for archetype
    let archetype = "";
    let summary = raw;
    const match = raw.match(/^Archetype:\s*([^\n]+)\n?/i);
    if (match) {
      archetype = match[1].trim();
      summary = raw.replace(match[0], '').trim();
    }

    // Fallback if AI ever fails
    const archetypeList = [
      "The Architect",
      "The Legacy Maker",
      "The Hot Shot",
      "The Hustler",
      "The Survivor",
      "The CEO in Training",
      "The Flexer",
      "The Flameout"
    ];
    if (!archetypeList.includes(archetype)) {
      archetype = "The Hot Shot";
    }

    res.json({
      summary,
      archetype
    });
  } catch (err) {
    console.error('❌ OpenAI API error:', err);
    res.status(500).json({ summary: `Internal error while generating summary: ${err.message}`, archetype: "The Hot Shot" });
  }
});

app.listen(PORT, () => {
  console.log(`🧠 AI Summary server running on http://localhost:${PORT}`);
});
