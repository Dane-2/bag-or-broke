// server/server.js

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;

// ✅ Allow both deployed and local frontend origins
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
  methods: ['POST'],
  credentials: false
}));

app.use(bodyParser.json());

app.post('/api/generate-summary', async (req, res) => {
  const playerData = req.body;

  const prompt = `
You are an AI game commentator for a college NIL simulation board game. Given this data, summarize the player's financial journey in 3–4 sentences, highlighting:
- What kind of player they were
- Risks and luxuries they pursued
- Any major outcomes (high cash, deep debt, curveballs, etc.)
- Their overall archetype or playing style

Here’s the data:
${JSON.stringify(playerData, null, 2)}
`;

  try {
    const ollama = spawn('ollama', ['run', 'mistral']);

    let result = '';
    let errorOutput = '';

    ollama.stdout.on('data', (data) => {
      result += data.toString();
    });

    ollama.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ollama.on('close', (code) => {
      if (code === 0 && result.trim()) {
        res.json({ summary: result.trim() });
      } else {
        console.error('❌ Ollama stderr:', errorOutput);
        res.status(500).json({ summary: 'AI Summary could not be generated.' });
      }
    });

    ollama.stdin.write(prompt);
    ollama.stdin.end();

  } catch (err) {
    console.error('❌ Internal server error:', err);
    res.status(500).json({ summary: 'Internal error while generating summary.' });
  }
});

app.listen(PORT, () => {
  console.log(`🧠 AI Summary server running on http://localhost:${PORT}`);
});
