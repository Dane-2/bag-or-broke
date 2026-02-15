const investmentCards = [
  { id: 'I1', title: 'Buy Vacant Property', cost: 30000, availableRisks: ['Moderate'], roiTables: { Moderate: [-10, 0, 10, 15, 20, 25] }, category: 'Real Estate' },
  { id: 'I2', title: 'Renovate the Property', cost: 40000, availableRisks: ['Moderate'], roiTables: { Moderate: [-15, -5, 10, 20, 25, 30] }, category: 'Real Estate' },
  { id: 'I3', title: 'Rent It Out Long-Term', cost: 60000, availableRisks: ['Low'], roiTables: { Low: [0, 10, 15, 20, 25, 30] }, category: 'Real Estate' },
  { id: 'I4', title: 'Start a YouTube Channel', cost: 10000, availableRisks: ['Moderate'], roiTables: { Moderate: [-10, 0, 10, 15, 25, 40] }, category: 'Content/Media' },
  { id: 'I5', title: 'Secure Sponsorship Deals', cost: 25000, availableRisks: ['Moderate'], roiTables: { Moderate: [-10, 0, 10, 20, 25, 35] }, category: 'Content/Media' },
  { id: 'I6', title: 'Become a Brand Influencer', cost: 50000, availableRisks: ['Moderate'], roiTables: { Moderate: [0, 10, 20, 30, 40, 60] }, category: 'Content/Media' },
  { id: 'I7', title: 'Launch Online Store', cost: 15000, availableRisks: ['Moderate'], roiTables: { Moderate: [-10, 0, 5, 10, 15, 20] }, category: 'E-Commerce' },
  { id: 'I8', title: 'Scale with Paid Ads', cost: 25000, availableRisks: ['High'], roiTables: { High: [-25, -10, 0, 15, 30, 50] }, category: 'E-Commerce' },
  { id: 'I9', title: 'License a Private Label Brand', cost: 50000, availableRisks: ['Moderate'], roiTables: { Moderate: [0, 10, 20, 30, 40, 60] }, category: 'E-Commerce' },
  { id: 'I10', title: 'Write a NIL Playbook eBook', cost: 12000, availableRisks: ['Low'], roiTables: { Low: [0, 5, 10, 15, 20, 25] }, category: 'NIL Education' },
  { id: 'I11', title: 'Launch Masterclass Series', cost: 25000, availableRisks: ['Moderate'], roiTables: { Moderate: [-10, 0, 10, 15, 25, 35] }, category: 'NIL Education' },
  { id: 'I12', title: 'National Speaking Tour', cost: 45000, availableRisks: ['Moderate'], roiTables: { Moderate: [0, 10, 15, 20, 30, 50] }, category: 'NIL Education' },
  { id: 'I13', title: 'Buy a Small Coin', cost: 5000, availableRisks: ['High'], roiTables: { High: [-50, -25, 0, 25, 50, 100] }, category: 'Crypto/Web3' },
  { id: 'I14', title: 'Stake NFT Assets', cost: 15000, availableRisks: ['High'], roiTables: { High: [-70, -30, 0, 40, 60, 100] }, category: 'Crypto/Web3' },
  { id: 'I15', title: 'Launch Token Collab', cost: 35000, availableRisks: ['High'], roiTables: { High: [-100, -50, 0, 50, 100, 150] }, category: 'Crypto/Web3' },
  { id: 'I16', title: 'Buy a Food Truck', cost: 25000, availableRisks: ['Moderate'], roiTables: { Moderate: [-10, 0, 10, 15, 25, 35] }, category: 'Food & Hospitality' },
  { id: 'I17', title: 'Add a Second Truck', cost: 35000, availableRisks: ['Moderate'], roiTables: { Moderate: [-15, 0, 15, 25, 30, 45] }, category: 'Food & Hospitality' },
  { id: 'I18', title: 'Open Brick-and-Mortar Restaurant', cost: 60000, availableRisks: ['Moderate'], roiTables: { Moderate: [-25, -10, 20, 30, 40, 60] }, category: 'Food & Hospitality' },
  { id: 'I19', title: 'Launch Supplement Line', cost: 20000, availableRisks: ['Moderate'], roiTables: { Moderate: [-10, 0, 10, 15, 25, 40] }, category: 'Fitness/Health' },
  { id: 'I20', title: 'Sign Athlete Influencers', cost: 30000, availableRisks: ['Moderate'], roiTables: { Moderate: [-15, 0, 15, 25, 30, 50] }, category: 'Fitness/Health' },
  { id: 'I21', title: 'Expand to Global Brand', cost: 65000, availableRisks: ['Moderate'], roiTables: { Moderate: [-30, 0, 25, 40, 50, 75] }, category: 'Fitness/Health' },
  { id: 'I22', title: 'Build a Backyard Gym', cost: 15000, availableRisks: ['Low'], roiTables: { Low: [0, 5, 10, 15, 20, 25] }, category: 'Fitness/Health' },
  { id: 'I23', title: 'Launch Training App', cost: 35000, availableRisks: ['Moderate'], roiTables: { Moderate: [-10, 0, 15, 25, 35, 50] }, category: 'Fitness/Health' },
  { id: 'I24', title: 'License Curriculum to Schools', cost: 70000, availableRisks: ['Moderate'], roiTables: { Moderate: [-20, 0, 30, 40, 60, 100] }, category: 'Fitness/Health' },
  { id: 'I25', title: 'Launch T-Shirt Brand', cost: 10000, availableRisks: ['Low'], roiTables: { Low: [0, 5, 10, 15, 20, 30] }, category: 'Fashion' },
  { id: 'I26', title: 'Drop Signature Collection', cost: 30000, availableRisks: ['Moderate'], roiTables: { Moderate: [-10, 0, 15, 25, 30, 45] }, category: 'Fashion' },
  { id: 'I27', title: 'Fashion Week Feature', cost: 60000, availableRisks: ['Moderate'], roiTables: { Moderate: [-15, 0, 25, 35, 50, 75] }, category: 'Fashion' },
  { id: 'I28', title: 'Record First Podcast Episode', cost: 10000, availableRisks: ['Low'], roiTables: { Low: [0, 5, 10, 15, 20, 30] }, category: 'Content/Media' },
  { id: 'I29', title: 'Build Podcast Network', cost: 30000, availableRisks: ['Moderate'], roiTables: { Moderate: [-10, 0, 15, 25, 35, 50] }, category: 'Content/Media' },
  { id: 'I30', title: 'Sign a Distribution Deal', cost: 50000, availableRisks: ['Moderate'], roiTables: { Moderate: [0, 20, 30, 40, 50, 75] }, category: 'Content/Media' },
  { id: 'I31', title: 'Buy an E-Commerce Store', cost: 25000, availableRisks: ['Moderate'], roiTables: { Moderate: [-10, 0, 15, 25, 30, 45] }, category: 'E-Commerce' },
  { id: 'I32', title: 'Sponsor an AAU Team', cost: 20000, availableRisks: ['Moderate'], roiTables: { Moderate: [-5, 0, 10, 20, 25, 35] }, category: 'NIL Community' },
  { id: 'I33', title: 'Acquire Sneaker Resale Inventory', cost: 15000, availableRisks: ['High'], roiTables: { High: [-25, -10, 0, 20, 40, 60] }, category: 'Support Services' },
  { id: 'I34', title: 'Write NIL Booklet', cost: 10000, availableRisks: ['Low'], roiTables: { Low: [0, 5, 10, 15, 20, 25] }, category: 'NIL Education' },
  { id: 'I35', title: 'Start a Social Media Ad Campaign', cost: 10000, availableRisks: ['Moderate'], roiTables: { Moderate: [-10, 0, 10, 20, 30, 50] }, category: 'Marketing/Ads' },
  { id: 'I36', title: 'Pay for a Business Coach', cost: 30000, availableRisks: ['Moderate'], roiTables: { Moderate: [-15, 0, 10, 20, 25, 40] }, category: 'Branding/Growth' },
  { id: 'I37', title: 'Hire a Web Developer', cost: 15000, availableRisks: ['Low'], roiTables: { Low: [0, 5, 10, 15, 20, 30] }, category: 'Developer Tools' },
  { id: 'I38', title: 'Start a Music Collab Studio', cost: 40000, availableRisks: ['High'], roiTables: { High: [-20, -10, 10, 25, 35, 50] }, category: 'Music/Creative' },
  { id: 'I39', title: 'Buy Billboard Ad', cost: 20000, availableRisks: ['Moderate'], roiTables: { Moderate: [0, 5, 15, 20, 30, 45] }, category: 'Marketing/Ads' },
  { id: 'I40', title: 'Invest in NIL Fund', cost: 50000, availableRisks: ['Low'], roiTables: { Low: [0, 10, 20, 25, 30, 40] }, category: 'Branding/Growth' },
  { id: 'I41', title: 'Buy an E-Commerce Store (Repeat)', cost: 25000, availableRisks: ['Moderate'], roiTables: { Moderate: [-10, 0, 15, 25, 30, 45] }, category: 'E-Commerce' },
  { id: 'I42', title: 'Sponsor an AAU Team (Repeat)', cost: 20000, availableRisks: ['Moderate'], roiTables: { Moderate: [-5, 0, 10, 20, 25, 35] }, category: 'NIL Community' },
  { id: 'I43', title: 'Acquire Sneaker Resale Inventory (Repeat)', cost: 15000, availableRisks: ['High'], roiTables: { High: [-25, -10, 0, 20, 40, 60] }, category: 'Support Services' },
  { id: 'I44', title: 'Write NIL Booklet (Repeat)', cost: 10000, availableRisks: ['Low'], roiTables: { Low: [0, 5, 10, 15, 20, 25] }, category: 'NIL Education' },
  { id: 'I45', title: 'Start a Social Media Ad Campaign (Repeat)', cost: 10000, availableRisks: ['Moderate'], roiTables: { Moderate: [-10, 0, 10, 20, 30, 50] }, category: 'Marketing/Ads' },
  { id: 'I46', title: 'Pay for a Business Coach (Repeat)', cost: 30000, availableRisks: ['Moderate'], roiTables: { Moderate: [-15, 0, 10, 20, 25, 40] }, category: 'Branding/Growth' },
  { id: 'I47', title: 'Hire a Web Developer (Repeat)', cost: 15000, availableRisks: ['Low'], roiTables: { Low: [0, 5, 10, 15, 20, 30] }, category: 'Developer Tools' },
  { id: 'I48', title: 'Start a Music Collab Studio (Repeat)', cost: 40000, availableRisks: ['High'], roiTables: { High: [-20, -10, 10, 25, 35, 50] }, category: 'Music/Creative' },
  { id: 'I49', title: 'Buy Billboard Ad (Repeat)', cost: 20000, availableRisks: ['Moderate'], roiTables: { Moderate: [0, 5, 15, 20, 30, 45] }, category: 'Marketing/Ads' },
  { id: 'I50', title: 'Invest in NIL Fund (Repeat)', cost: 50000, availableRisks: ['Low'], roiTables: { Low: [0, 10, 20, 25, 30, 40] }, category: 'Branding/Growth' },
  
  // =====================================================
  // REAL ESTATE EXPANSION CARDS
  // =====================================================
  
  // RE_SHORT_TERM_RENTAL - Upgrade (requires rental property)
  { 
    id: 'RE_SHORT_TERM_RENTAL', 
    title: 'Convert to Short-Term Rental', 
    cost: 50000, 
    availableRisks: ['High'], 
    roiTables: { High: [-30, -15, 0, 25, 40, 60] }, 
    category: 'Real Estate',
    type: 'Upgrade',
    requirements: { hasRentalProperty: true },
    portfolioEffects: {
      real_estate_active: true,
      high_volatility: true,
      hospitality_exposure: true
    },
    protectionInteraction: {
      blocks: ['Unexpected Lawsuit', 'Federal Tax Audit']
    }
  },
  
  // RE_DUPLEX - Multi-Unit
  { 
    id: 'RE_DUPLEX', 
    title: 'Acquire Duplex', 
    cost: 300000, 
    availableRisks: ['Moderate'], 
    roiTables: { Moderate: [-10, 0, 10, 20, 30, 40] }, 
    category: 'Real Estate',
    type: 'Multi-Unit',
    portfolioEffects: {
      rental_units: 2,
      qualifies_multi_unit: true
    }
  },
  
  // RE_TRIPLEX - Multi-Unit (requires rental property)
  { 
    id: 'RE_TRIPLEX', 
    title: 'Acquire Triplex', 
    cost: 500000, 
    availableRisks: ['Moderate-High'], 
    roiTables: { 'Moderate-High': [-15, 0, 15, 25, 35, 50] }, 
    category: 'Real Estate',
    type: 'Multi-Unit',
    requirements: { hasRentalProperty: true },
    portfolioEffects: {
      rental_units: 3,
      debt_sensitive: true
    }
  },
  
  // RE_FOURPLEX - Institutional Residential
  { 
    id: 'RE_FOURPLEX', 
    title: 'Acquire Fourplex', 
    cost: 1000000, 
    availableRisks: ['High'], 
    roiTables: { High: [-20, -5, 15, 30, 45, 65] }, 
    category: 'Real Estate',
    type: 'Institutional Residential',
    portfolioEffects: {
      rental_units: 4,
      institutional_asset: true,
      unlocks_commercial: true,
      qualifies_empire: true
    }
  },
  
  // RE_COMMERCIAL - Commercial Asset (requires multi-unit)
  { 
    id: 'RE_COMMERCIAL', 
    title: 'Acquire Commercial Real Estate', 
    cost: 2000000, 
    availableRisks: ['Moderate-High'], 
    roiTables: { 'Moderate-High': [-25, -10, 20, 35, 50, 75] }, 
    category: 'Real Estate',
    type: 'Commercial Asset',
    requirements: { hasMultiUnit: true },
    portfolioEffects: {
      commercial_asset: true,
      tenant_dependency: true,
      qualifies_empire: true
    }
  },
  
  // RE_REIT - Passive Real Estate (repeatable)
  { 
    id: 'RE_REIT', 
    title: 'Invest in REITs', 
    cost: 50000, 
    availableRisks: ['Low-Moderate'], 
    roiTables: { 'Low-Moderate': [-5, 0, 8, 12, 18, 25] }, 
    category: 'Financial Instruments',
    type: 'Passive Real Estate',
    repeatable: true,
    portfolioEffects: {
      passive_real_estate: true,
      high_liquidity: true,
      lower_exit_tax: true
    }
  },
  
  // RE_HOLDCO - Protection Card (Holding Company)
  { 
    id: 'RE_HOLDCO', 
    title: 'Form a Holding Company', 
    cost: 25000, 
    availableRisks: ['Low'], 
    roiTables: { Low: [0, 2, 5, 7, 10, 12] }, 
    category: 'Legal / Structure',
    type: 'Portfolio Infrastructure',
    protectionFlags: {
      blocks_unexpected_lawsuit: true,
      blocks_federal_tax_audit: true
    },
    portfolioEffects: {
      entity_owned_assets: true,
      improves_exit_tax: true,
      empire_bonus_eligible: true
    }
  },
  
  // RE_INSURANCE - Protection Card (Insurance & Capital Reserves)
  { 
    id: 'RE_INSURANCE', 
    title: 'Insurance & Capital Reserves', 
    cost: 20000, 
    availableRisks: ['Low'], 
    roiTables: { Low: [0, 3, 5, 7, 10, 15] }, 
    category: 'Risk Management',
    type: 'Defensive Infrastructure',
    protectionFlags: {
      blocks_unexpected_lawsuit: true,
      blocks_federal_tax_audit: true
    },
    portfolioEffects: {
      loss_mitigation: true,
      empire_bonus_eligible: true
    }
  },
  
  // =====================================================
  // CASH-VALUE LIFE INSURANCE CARDS
  // =====================================================
  
  // INV_LIFE_INSURANCE_TIER_A
  { 
    id: 'INV_LIFE_INSURANCE_TIER_A', 
    title: 'Cash-Value Life Insurance — Tier A', 
    cost: 25000, 
    availableRisks: [], 
    roiTables: {}, 
    category: 'Life Insurance',
    type: 'Life Insurance',
    cashOnly: true,
    noDice: true,
    startingFaceAmount: 100000,
    startingCashValue: 25000,
    portfolioEffects: {
      guaranteed_asset: true,
      borrowable_liquidity: true,
      defensive_core: true,
      impenetrable_wealth_component: true
    }
  },
  
  // INV_LIFE_INSURANCE_TIER_B
  { 
    id: 'INV_LIFE_INSURANCE_TIER_B', 
    title: 'Cash-Value Life Insurance — Tier B', 
    cost: 75000, 
    availableRisks: [], 
    roiTables: {}, 
    category: 'Life Insurance',
    type: 'Life Insurance',
    cashOnly: true,
    noDice: true,
    startingFaceAmount: 250000,
    startingCashValue: 75000,
    portfolioEffects: {
      guaranteed_asset: true,
      borrowable_liquidity: true,
      defensive_core: true,
      impenetrable_wealth_component: true
    }
  },
  
  // INV_LIFE_INSURANCE_TIER_C
  { 
    id: 'INV_LIFE_INSURANCE_TIER_C', 
    title: 'Cash-Value Life Insurance — Tier C', 
    cost: 100000, 
    availableRisks: [], 
    roiTables: {}, 
    category: 'Life Insurance',
    type: 'Life Insurance',
    cashOnly: true,
    noDice: true,
    startingFaceAmount: 500000,
    startingCashValue: 100000,
    portfolioEffects: {
      guaranteed_asset: true,
      borrowable_liquidity: true,
      defensive_core: true,
      impenetrable_wealth_component: true
    }
  },
  
  // INV_LIFE_INSURANCE_TIER_D
  { 
    id: 'INV_LIFE_INSURANCE_TIER_D', 
    title: 'Cash-Value Life Insurance — Tier D', 
    cost: 250000, 
    availableRisks: [], 
    roiTables: {}, 
    category: 'Life Insurance',
    type: 'Life Insurance',
    cashOnly: true,
    noDice: true,
    startingFaceAmount: 1000000,
    startingCashValue: 250000,
    portfolioEffects: {
      guaranteed_asset: true,
      borrowable_liquidity: true,
      defensive_core: true,
      impenetrable_wealth_component: true
    }
  },
  
  // =====================================================
  // DEFERRED INCOME ANNUITY CARDS
  // =====================================================
  
  // INV_ANNUITY_TIER_5Y
  { 
    id: 'INV_ANNUITY_TIER_5Y', 
    title: 'Deferred Income Annuity — 5 Year', 
    cost: 50000, 
    availableRisks: [], 
    roiTables: {}, 
    category: 'Annuities',
    type: 'Annuity',
    cashOnly: true,
    noDice: true,
    maturityLaps: 1,
    perLapPayout: 25000,
    portfolioEffects: {
      guaranteed_income: true,
      patience_tier_1: true,
      impenetrable_wealth_component: true
    }
  },
  
  // INV_ANNUITY_TIER_10Y
  { 
    id: 'INV_ANNUITY_TIER_10Y', 
    title: 'Deferred Income Annuity — 10 Year', 
    cost: 100000, 
    availableRisks: [], 
    roiTables: {}, 
    category: 'Annuities',
    type: 'Annuity',
    cashOnly: true,
    noDice: true,
    maturityLaps: 2,
    perLapPayout: 50000,
    portfolioEffects: {
      guaranteed_income: true,
      patience_tier_2: true,
      impenetrable_wealth_component: true
    }
  },
  
  // INV_ANNUITY_TIER_15Y
  { 
    id: 'INV_ANNUITY_TIER_15Y', 
    title: 'Deferred Income Annuity — 15 Year', 
    cost: 150000, 
    availableRisks: [], 
    roiTables: {}, 
    category: 'Annuities',
    type: 'Annuity',
    cashOnly: true,
    noDice: true,
    maturityLaps: 3,
    perLapPayout: 75000,
    portfolioEffects: {
      guaranteed_income: true,
      patience_tier_3: true,
      impenetrable_wealth_component: true
    }
  },
  
  // INV_ANNUITY_TIER_20Y
  { 
    id: 'INV_ANNUITY_TIER_20Y', 
    title: 'Deferred Income Annuity — 20 Year', 
    cost: 200000, 
    availableRisks: [], 
    roiTables: {}, 
    category: 'Annuities',
    type: 'Annuity',
    cashOnly: true,
    noDice: true,
    maturityLaps: 4,
    perLapPayout: 100000,
    portfolioEffects: {
      guaranteed_income: true,
      patience_tier_4: true,
      elite_income_engine: true,
      impenetrable_wealth_component: true
    }
  },
  
  // =====================================================
  // OFFENSIVE PLANNING CARDS
  // =====================================================
  
  // OFF_STOCKS
  { 
    id: 'OFF_STOCKS', 
    title: 'Invest in Stocks', 
    cost: 20000, 
    availableRisks: ['High'], 
    roiTables: { High: [-25, -10, 0, 20, 35, 50] }, 
    category: 'Offensive Planning',
    type: 'Offensive Planning',
    investmentType: 'offensivePlanning',
    portfolioEffects: {
      high_volatility: true,
      growth_chaser: true,
      offensive_asset: true
    }
  },
  
  // OFF_ETFS
  { 
    id: 'OFF_ETFS', 
    title: 'Invest in ETFs', 
    cost: 20000, 
    availableRisks: ['Moderate'], 
    roiTables: { Moderate: [-10, 0, 10, 18, 25, 35] }, 
    category: 'Offensive Planning',
    type: 'Offensive Planning',
    investmentType: 'offensivePlanning',
    portfolioEffects: {
      diversified_growth: true,
      modern_allocator: true,
      offensive_asset: true
    }
  },
  
  // OFF_BONDS
  { 
    id: 'OFF_BONDS', 
    title: 'Invest in Bonds', 
    cost: 15000, 
    availableRisks: ['Low'], 
    roiTables: { Low: [-5, 0, 5, 8, 10, 12] }, 
    category: 'Offensive Planning',
    type: 'Offensive Planning',
    investmentType: 'offensivePlanning',
    portfolioEffects: {
      capital_preservation: true,
      volatility_buffer: true,
      offensive_asset: true
    }
  },
  
  // =====================================================
  // DEFENSIVE PLANNING CARDS (CONSUMABLE PROTECTION)
  // =====================================================
  
  // Health & Disability Protection - Basic
  { 
    id: 'DEF_HEALTH_BASIC', 
    title: 'Health & Disability Protection — Basic', 
    cost: 5000, 
    availableRisks: [], 
    roiTables: {}, 
    category: 'Defensive Planning',
    type: 'Defensive Protection',
    investmentType: 'healthDisabilityProtection',
    protectionType: 'health',
    usesRemaining: 1,
    cashOnly: true,
    noDice: true,
    protectsAgainst: ['Season-Ending Injury', 'Family Emergency', 'Unexpected Pregnancy']
  },
  
  // Health & Disability Protection - Standard
  { 
    id: 'DEF_HEALTH_STANDARD', 
    title: 'Health & Disability Protection — Standard', 
    cost: 10000, 
    availableRisks: [], 
    roiTables: {}, 
    category: 'Defensive Planning',
    type: 'Defensive Protection',
    investmentType: 'healthDisabilityProtection',
    protectionType: 'health',
    usesRemaining: 2,
    cashOnly: true,
    noDice: true,
    protectsAgainst: ['Season-Ending Injury', 'Family Emergency', 'Unexpected Pregnancy']
  },
  
  // Health & Disability Protection - Premium
  { 
    id: 'DEF_HEALTH_PREMIUM', 
    title: 'Health & Disability Protection — Premium', 
    cost: 15000, 
    availableRisks: [], 
    roiTables: {}, 
    category: 'Defensive Planning',
    type: 'Defensive Protection',
    investmentType: 'healthDisabilityProtection',
    protectionType: 'health',
    usesRemaining: 3,
    cashOnly: true,
    noDice: true,
    protectsAgainst: ['Season-Ending Injury', 'Family Emergency', 'Unexpected Pregnancy']
  },
  
  // Legal Protection - Basic
  { 
    id: 'DEF_LEGAL_BASIC', 
    title: 'Legal Protection — Basic', 
    cost: 5000, 
    availableRisks: [], 
    roiTables: {}, 
    category: 'Defensive Planning',
    type: 'Defensive Protection',
    investmentType: 'legalProtection',
    protectionType: 'legal',
    usesRemaining: 1,
    cashOnly: true,
    noDice: true,
    protectsAgainst: ['Unexpected Lawsuit', 'IRS Audit', 'Federal Tax Audit', 'Last-Minute NIL Lawsuit']
  },
  
  // Legal Protection - Standard
  { 
    id: 'DEF_LEGAL_STANDARD', 
    title: 'Legal Protection — Standard', 
    cost: 10000, 
    availableRisks: [], 
    roiTables: {}, 
    category: 'Defensive Planning',
    type: 'Defensive Protection',
    investmentType: 'legalProtection',
    protectionType: 'legal',
    usesRemaining: 2,
    cashOnly: true,
    noDice: true,
    protectsAgainst: ['Unexpected Lawsuit', 'IRS Audit', 'Federal Tax Audit', 'Last-Minute NIL Lawsuit']
  },
  
  // Legal Protection - Premium
  { 
    id: 'DEF_LEGAL_PREMIUM', 
    title: 'Legal Protection — Premium', 
    cost: 15000, 
    availableRisks: [], 
    roiTables: {}, 
    category: 'Defensive Planning',
    type: 'Defensive Protection',
    investmentType: 'legalProtection',
    protectionType: 'legal',
    usesRemaining: 3,
    cashOnly: true,
    noDice: true,
    protectsAgainst: ['Unexpected Lawsuit', 'IRS Audit', 'Federal Tax Audit', 'Last-Minute NIL Lawsuit']
  },
  
  // Umbrella Liability Coverage
  { 
    id: 'DEF_UMBRELLA', 
    title: 'Umbrella Liability Coverage', 
    cost: 100000, 
    availableRisks: [], 
    roiTables: {}, 
    category: 'Defensive Planning',
    type: 'Defensive Protection',
    investmentType: 'umbrellaLiability',
    protectionType: 'umbrella',
    usesRemaining: -1, // -1 means unlimited
    cashOnly: true,
    noDice: true,
    repeatable: false, // One per player
    protectsAgainst: ['ALL'] // Protects against all curveballs
  }
];

export default investmentCards;
