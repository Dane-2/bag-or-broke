const investmentCards = [
  {
    id: 'INV001',
    title: 'Buy Vacant Property',
    cost: 30000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-10, 0, 10, 15, 20, 25]
    }
  },
  {
    id: 'INV002',
    title: 'Renovate the Property',
    cost: 40000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-15, -5, 10, 20, 25, 30]
    }
  },
  {
    id: 'INV003',
    title: 'Rent It Out Long-Term',
    cost: 60000,
    availableRisks: ['Low'],
    roiTables: {
      Low: [0, 10, 15, 20, 25, 30]
    }
  },
  {
    id: 'INV004',
    title: 'Start a YouTube Channel',
    cost: 10000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-10, 0, 10, 15, 25, 40]
    }
  },
  {
    id: 'INV005',
    title: 'Secure Sponsorship Deals',
    cost: 25000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-10, 0, 10, 20, 25, 35]
    }
  },
  {
    id: 'INV006',
    title: 'Become a Brand Influencer',
    cost: 50000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [0, 10, 20, 30, 40, 60]
    }
  },
  {
    id: 'INV007',
    title: 'Launch Online Store',
    cost: 15000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-10, 0, 5, 10, 15, 20]
    }
  },
  {
    id: 'INV008',
    title: 'Scale with Paid Ads',
    cost: 25000,
    availableRisks: ['High'],
    roiTables: {
      High: [-25, -10, 0, 15, 30, 50]
    }
  },
  {
    id: 'INV009',
    title: 'License a Private Label Brand',
    cost: 50000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [0, 10, 20, 30, 40, 60]
    }
  },
  {
    id: 'INV010',
    title: 'Write a NIL Playbook eBook',
    cost: 12000,
    availableRisks: ['Low'],
    roiTables: {
      Low: [0, 5, 10, 15, 20, 25]
    }
  },
  {
    id: 'INV011',
    title: 'Launch Masterclass Series',
    cost: 25000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-10, 0, 10, 15, 25, 35]
    }
  },
  {
    id: 'INV012',
    title: 'National Speaking Tour',
    cost: 45000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [0, 10, 15, 20, 30, 50]
    }
  },
  {
    id: 'INV013',
    title: 'Buy a Small Coin',
    cost: 5000,
    availableRisks: ['High'],
    roiTables: {
      High: [-50, -25, 0, 25, 50, 100]
    }
  },
  {
    id: 'INV014',
    title: 'Stake NFT Assets',
    cost: 15000,
    availableRisks: ['High'],
    roiTables: {
      High: [-70, -30, 0, 40, 60, 100]
    }
  },
  {
    id: 'INV015',
    title: 'Launch Token Collab',
    cost: 35000,
    availableRisks: ['High'],
    roiTables: {
      High: [-100, -50, 0, 50, 100, 150]
    }
  },
  {
    id: 'INV016',
    title: 'Buy a Food Truck',
    cost: 25000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-10, 0, 10, 15, 25, 35]
    }
  },
  {
    id: 'INV017',
    title: 'Add a Second Truck',
    cost: 35000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-15, 0, 15, 25, 30, 45]
    }
  },
  {
    id: 'INV018',
    title: 'Open Brick-and-Mortar Restaurant',
    cost: 60000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-25, -10, 20, 30, 40, 60]
    }
  },
  {
    id: 'INV019',
    title: 'Launch Supplement Line',
    cost: 20000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-10, 0, 10, 15, 25, 40]
    }
  },
  {
    id: 'INV020',
    title: 'Sign Athlete Influencers',
    cost: 30000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-15, 0, 15, 25, 30, 50]
    }
  },
  {
    id: 'INV021',
    title: 'Expand to Global Brand',
    cost: 65000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-30, 0, 25, 40, 50, 75]
    }
  },
  {
    id: 'INV022',
    title: 'Build a Backyard Gym',
    cost: 15000,
    availableRisks: ['Low'],
    roiTables: {
      Low: [0, 5, 10, 15, 20, 25]
    }
  },
  {
    id: 'INV023',
    title: 'Launch Training App',
    cost: 35000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-10, 0, 15, 25, 35, 50]
    }
  },
  {
    id: 'INV024',
    title: 'License Curriculum to Schools',
    cost: 70000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-20, 0, 30, 40, 60, 100]
    }
  },
  {
    id: 'INV025',
    title: 'Launch T-Shirt Brand',
    cost: 10000,
    availableRisks: ['Low'],
    roiTables: {
      Low: [0, 5, 10, 15, 20, 30]
    }
  },
  {
    id: 'INV026',
    title: 'Drop Signature Collection',
    cost: 30000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-10, 0, 15, 25, 30, 45]
    }
  },
  {
    id: 'INV027',
    title: 'Fashion Week Feature',
    cost: 60000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-15, 0, 25, 35, 50, 75]
    }
  },
  {
    id: 'INV028',
    title: 'Record First Podcast Episode',
    cost: 10000,
    availableRisks: ['Low'],
    roiTables: {
      Low: [0, 5, 10, 15, 20, 30]
    }
  },
  {
    id: 'INV029',
    title: 'Build Podcast Network',
    cost: 30000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-10, 0, 15, 25, 35, 50]
    }
  },
  {
    id: 'INV030',
    title: 'Sign a Distribution Deal',
    cost: 50000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [0, 20, 30, 40, 50, 75]
    }
  },
  {
    id: 'INV031',
    title: 'Buy an E-Commerce Store',
    cost: 25000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-10, 0, 15, 25, 30, 45]
    }
  },
  {
    id: 'INV032',
    title: 'Sponsor an AAU Team',
    cost: 20000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-5, 0, 10, 20, 25, 35]
    }
  },
  {
    id: 'INV033',
    title: 'Acquire Sneaker Resale Inventory',
    cost: 15000,
    availableRisks: ['High'],
    roiTables: {
      High: [-25, -10, 0, 20, 40, 60]
    }
  },
  {
    id: 'INV034',
    title: 'Write NIL Booklet',
    cost: 10000,
    availableRisks: ['Low'],
    roiTables: {
      Low: [0, 5, 10, 15, 20, 25]
    }
  },
  {
    id: 'INV035',
    title: 'Start a Social Media Ad Campaign',
    cost: 10000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-10, 0, 10, 20, 30, 50]
    }
  },
  {
    id: 'INV036',
    title: 'Pay for a Business Coach',
    cost: 30000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [-15, 0, 10, 20, 25, 40]
    }
  },
  {
    id: 'INV037',
    title: 'Hire a Web Developer',
    cost: 15000,
    availableRisks: ['Low'],
    roiTables: {
      Low: [0, 5, 10, 15, 20, 30]
    }
  },
  {
    id: 'INV038',
    title: 'Start a Music Collab Studio',
    cost: 40000,
    availableRisks: ['High'],
    roiTables: {
      High: [-20, -10, 10, 25, 35, 50]
    }
  },
  {
    id: 'INV039',
    title: 'Buy Billboard Ad',
    cost: 20000,
    availableRisks: ['Moderate'],
    roiTables: {
      Moderate: [0, 5, 15, 20, 30, 45]
    }
  },
  {
    id: 'INV040',
    title: 'Invest in NIL Fund',
    cost: 50000,
    availableRisks: ['Low'],
    roiTables: {
      Low: [0, 10, 20, 25, 30, 40]
    }
  },
  // INV041–INV050: Repeatable Standalone Cards (Same logic as 31–40)
{
  id: 'INV041',
  title: 'Buy an E-Commerce Store (Repeat)',
  cost: 25000,
  availableRisks: ['Moderate'],
  roiTables: {
    Moderate: [-10, 0, 15, 25, 30, 45]
  }
},
{
  id: 'INV042',
  title: 'Sponsor an AAU Team (Repeat)',
  cost: 20000,
  availableRisks: ['Moderate'],
  roiTables: {
    Moderate: [-5, 0, 10, 20, 25, 35]
  }
},
{
  id: 'INV043',
  title: 'Acquire Sneaker Resale Inventory (Repeat)',
  cost: 15000,
  availableRisks: ['High'],
  roiTables: {
    High: [-25, -10, 0, 20, 40, 60]
  }
},
{
  id: 'INV044',
  title: 'Write NIL Booklet (Repeat)',
  cost: 10000,
  availableRisks: ['Low'],
  roiTables: {
    Low: [0, 5, 10, 15, 20, 25]
  }
},
{
  id: 'INV045',
  title: 'Start a Social Media Ad Campaign (Repeat)',
  cost: 10000,
  availableRisks: ['Moderate'],
  roiTables: {
    Moderate: [-10, 0, 10, 20, 30, 50]
  }
},
{
  id: 'INV046',
  title: 'Pay for a Business Coach (Repeat)',
  cost: 30000,
  availableRisks: ['Moderate'],
  roiTables: {
    Moderate: [-15, 0, 10, 20, 25, 40]
  }
},
{
  id: 'INV047',
  title: 'Hire a Web Developer (Repeat)',
  cost: 15000,
  availableRisks: ['Low'],
  roiTables: {
    Low: [0, 5, 10, 15, 20, 30]
  }
},
{
  id: 'INV048',
  title: 'Start a Music Collab Studio (Repeat)',
  cost: 40000,
  availableRisks: ['High'],
  roiTables: {
    High: [-20, -10, 10, 25, 35, 50]
  }
},
{
  id: 'INV049',
  title: 'Buy Billboard Ad (Repeat)',
  cost: 20000,
  availableRisks: ['Moderate'],
  roiTables: {
    Moderate: [0, 5, 15, 20, 30, 45]
  }
},
{
  id: 'INV050',
  title: 'Invest in NIL Fund (Repeat)',
  cost: 50000,
  availableRisks: ['Low'],
  roiTables: {
    Low: [0, 10, 20, 25, 30, 40]
  }
}

];

export default investmentCards;
