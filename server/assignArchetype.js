// server/assignArchetype.js

function assignArchetype(player) {
  // Example: Adjust weights/rules as needed for your actual game logic!
  const { investments = [], luxuries = [], rep, career, credit, debt, shadyDebt } = player;

  // Example logic (customize to your needs!):
  if ((investments.length >= 4) && rep >= 3 && career >= 2 && luxuries.length <= 2 && debt < 50000) {
    return "The Architect";
  }
  if (career >= 4 && rep >= 4 && investments.length >= 2 && luxuries.length <= 1) {
    return "The Legacy Maker";
  }
  if (luxuries.length > 4 && investments.length < 2 && (debt > 50000 || credit < 600)) {
    return "The Flexer";
  }
  if (investments.length >= 4 && credit < 650 && shadyDebt > 0) {
    return "The Hustler";
  }
  if (debt > 100000 || shadyDebt > 30000) {
    return "The Survivor";
  }
  if (investments.length === 0 && luxuries.length >= 4 && (debt > 50000 || rep < 2)) {
    return "The Flameout";
  }
  if (investments.length >= 2 && career >= 2 && rep >= 2 && luxuries.length <= 2) {
    return "The CEO in Training";
  }
  // Default/fallback:
  return "The Hot Shot";
}

module.exports = assignArchetype;
