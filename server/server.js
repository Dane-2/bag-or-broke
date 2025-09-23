// server/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
// No need for node-fetch; Node 18+ has fetch built-in

const app = express();
const PORT = process.env.PORT || 3001;

// Allow deployed Vercel frontend and local dev
const allowedOrigins = [
  'http://localhost:3000',
  'https://bag-or-broke.vercel.app'
];

// CORS setup: allow Vercel & localhost, all methods needed
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

// Health check endpoint for Render/monitoring
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is running!' });
});

// AI Summary Endpoint (OpenAI)
app.post('/api/generate-summary', async (req, res) => {
  const playerData = req.body;

  // --- Prompt can be replaced with your custom formatter if desired
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
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // Or 'gpt-4o' if you want (be sure your key supports it)
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 180,
        temperature: 0.7,
      }),
    });

    // Read the API response and log it for debugging
    const data = await response.json();
    console.log('🔎 OpenAI API raw response:', data);

    // If OpenAI returns a valid response
    if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
      res.json({ summary: data.choices[0].message.content.trim() });
    } else {
      // Log detailed OpenAI error
      console.error('❌ OpenAI API detailed error:', data);
      res.status(500).json({ summary: 'AI Summary could not be generated.' });
    }
  } catch (err) {
    // If the fetch itself fails, log and return message
    console.error('❌ OpenAI API error:', err);
    res.status(500).json({ summary: `Internal error while generating summary: ${err.message}` });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🧠 AI Summary server running on http://localhost:${PORT}`);
});
