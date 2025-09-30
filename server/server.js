// server/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const assignArchetype = require('./assignArchetype'); // <- Add this

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
  const archetype = assignArchetype(playerData);

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
You are an AI NIL game commentator. Based on the player's game data, our system suggests the archetype: **${archetype}**.
If you agree, use it in your summary. If you believe a different archetype from the list below fits better, select it and explain why in 1 sentence before your summary.

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
        model: 'gpt-3.5-turbo', // Or 'gpt-4o' if you want
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 220,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    console.log('🔎 OpenAI API raw response:', data);

    if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
      res.json({
        summary: data.choices[0].message.content.trim(),
        archetype
      });
    } else {
      console.error('❌ OpenAI API detailed error:', data);
      res.status(500).json({ summary: 'AI Summary could not be generated.', archetype });
    }
  } catch (err) {
    console.error('❌ OpenAI API error:', err);
    res.status(500).json({ summary: `Internal error while generating summary: ${err.message}`, archetype });
  }
});

app.listen(PORT, () => {
  console.log(`🧠 AI Summary server running on http://localhost:${PORT}`);
});
