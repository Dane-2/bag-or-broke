import React, { useState } from 'react';

const purpleEvents = [
  { name: 'Resume Workshop', rep: 2, career: 1 },
  { name: 'Community Service', rep: 4, career: 1 },
  { name: 'Leadership Retreat', rep: 2, career: 2 },
  { name: 'Landed an Internship', rep: 1, career: 3 },
  { name: 'Graduate On Time', rep: 2, career: 4 },
  { name: 'Get Mentored', rep: 1, career: 2 }
];

function PurpleTab({ onSelect, addToast }) {
  const [selectedEventName, setSelectedEventName] = useState('');

  const handleSelect = (eventName) => {
    if (!eventName) return;
    
    const event = purpleEvents.find(e => e.name === eventName);
    if (event) {
      onSelect(event);
      addToast(`Purple Event: ${event.name} - +${event.rep} REP, +${event.career} Career`, 'success', 4000);
      setSelectedEventName(''); // Reset dropdown after selection
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-purple-600 mb-4">
        Purple (REP + Career)
      </h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Purple Event
        </label>
        <select
          value={selectedEventName}
          onChange={(e) => {
            setSelectedEventName(e.target.value);
            handleSelect(e.target.value);
          }}
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="">-- Select an event --</option>
          {purpleEvents.map((event, idx) => (
            <option key={idx} value={event.name}>
              {event.name} (+{event.rep} REP, +{event.career} Career)
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

export default PurpleTab;
