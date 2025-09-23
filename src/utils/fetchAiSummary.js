// src/utils/fetchAiSummary.js

const API_URL = process.env.REACT_APP_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://bag-or-broke-47pl.onrender.com";

export async function fetchAiSummary(playerData) {
  try {
    const response = await fetch(`${API_URL}/api/generate-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(playerData),
    });

    if (!response.ok) {
      throw new Error(`AI summary fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.summary || 'No summary returned.';
  } catch (error) {
    console.error('❌ Error fetching AI summary:', error);
    return 'AI Summary could not be generated.';
  }
}
