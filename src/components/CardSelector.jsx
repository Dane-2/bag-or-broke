// CardSelector.jsx
import { useState } from 'react';
import CardPreview from './CardPreview';
import investmentCards from '../data/investments';
import luxuryCards from '../data/luxuryCards';

const tabs = {
  investment: [
    'All', 'Real Estate', 'E-Commerce', 'Crypto/Web3', 'Fitness/Health',
    'Content/Media', 'NIL Education', 'Food & Hospitality', 'Fashion',
    'Marketing/Ads', 'Developer Tools', 'Music/Creative', 'Support Services',
    'Branding/Growth', 'NIL Community'
  ],
  luxury: [
    'All', 'Style', 'Vehicle', 'Event', 'Travel', 'Lifestyle',
    'Career/Brand', 'Business/Flex', 'Social Flex', 'Brand/Flex',
    'Flex/Travel', 'Content', 'Style/Flex', 'Brand/Image', 'Flex/Marketing',
    'Style/Brand'
  ]
};

export default function CardSelector({ type, onSelect }) {
  const [activeTab, setActiveTab] = useState('All');

  const cards = type === 'investment' ? investmentCards : luxuryCards;

  const filtered = cards.filter((card) =>
    activeTab === 'All' ? true : card.category.includes(activeTab)
  );

  return (
    <div className="space-y-4">
      {/* Tab Buttons */}
      <div className="flex flex-wrap gap-2">
        {tabs[type].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded-full border text-sm ${
              activeTab === tab ? 'bg-black text-white' : 'bg-white text-black'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filtered.map((card) => (
          <CardPreview key={card.id} card={card} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
} 