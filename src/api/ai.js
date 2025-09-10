// src/api/ai.js

export async function fetchAiSummary(playerData) {
  try {
    const response = await fetch('https://bag-or-broke.onrender.com/api/generate-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(playerData),
    });

    if (!response.ok) {
      throw new Error(`AI summary fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.summary; // string
  } catch (error) {
    console.error('❌ Error fetching AI summary:', error);
    return 'AI Summary could not be generated.';
  }
}
