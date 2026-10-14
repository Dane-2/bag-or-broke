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

  const reveal = playerData.reveal || null;

  // The game's rules engine assigns the playstyle pattern from recorded choices. The AI only
  // explains it in plain language; it must not choose a different pattern or judge character.
  const prompt = reveal
    ? `
You are writing the end-of-game recap for a student playing "Bag or Broke: NIL Money Moves", a financial simulation game.
The game's rules already assigned this playstyle pattern: ${reveal.assignedPattern} (${reveal.patternState}).
${reveal.patternDescription ? `Pattern description: ${reveal.patternDescription}` : ''}

Write 4 short paragraphs with these headings, using only the facts below:
1. What you chose
2. What happened outside your control
3. How you adjusted
4. One option to explore next time

Rules:
- Use the pattern name exactly as given. Never pick or suggest a different pattern.
- Describe actions in this game, not permanent traits, intelligence, morality, creditworthiness or future success.
- Do not treat bad luck (lawsuits, injuries, market losses) as a personal failing.
- Do not invent numbers, events or intentions that are not in the facts.
- Address the player by name. Do not mention yourself or AI.

Facts:
Name: ${playerData.playerName || playerData.name || 'Player'}
Decisions: ${JSON.stringify(reveal.decisions || [])}
Setbacks: ${JSON.stringify(reveal.setbacks || [])}
Suggested next step: ${reveal.nextTime || ''}
Final cash: ${playerData.cash}; debt: ${playerData.debt}; REP: ${playerData.rep}; Career: ${playerData.career}; credit score: ${playerData.credit}
`
    : null;

  if (!prompt) {
    return res.status(400).json({ summary: '', grounded: false, error: 'Missing reveal facts' });
  }

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
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (!data.choices || !data.choices[0]?.message?.content) {
      throw new Error(JSON.stringify(data));
    }
    const summary = data.choices[0].message.content.trim();
    res.json({ summary, archetype: reveal.assignedPattern, grounded: true });
  } catch (err) {
    console.error('❌ OpenAI API error:', err);
    res.status(500).json({ summary: '', grounded: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🧠 AI Summary server running on http://localhost:${PORT}`);
});
