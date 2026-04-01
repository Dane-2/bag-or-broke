const luxuryCards = [
  { id: 'L1', title: 'Custom Gold Chain', cost: 50000, resale: 25000, rep: 2, category: 'Style' },
  { id: 'L2', title: 'Exotic Car Rental (Weekend)', cost: 30000, resale: 15000, rep: 1, category: 'Vehicle' },
  { id: 'L3', title: 'Designer Shopping Spree', cost: 20000, resale: 10000, rep: 1, category: 'Style' },
  { id: 'L4', title: 'Private Jet Flight', cost: 120000, resale: 50000, rep: 3, category: 'Travel' },
  { id: 'L5', title: 'Penthouse Party', cost: 80000, resale: 30000, rep: 2, category: 'Event' },
  { id: 'L6', title: 'Luxury Watch', cost: 75000, resale: 35000, rep: 2, category: 'Style' },
  { id: 'L7', title: 'Yacht Party Weekend', cost: 200000, resale: 80000, rep: 4, category: 'Event' },
  { id: 'L8', title: 'Custom Sneaker Drop', cost: 25000, resale: 12000, rep: 1, category: 'Style' },
  { id: 'L9', title: 'Birthday Bash (Club)', cost: 60000, resale: 25000, rep: 2, category: 'Event' },
  { id: 'L10', title: 'Designer Luggage Set', cost: 15000, resale: 8000, rep: 1, category: 'Style' },
  { id: 'L11', title: 'NBA Courtside Tickets', cost: 35000, resale: 15000, rep: 2, category: 'Flex' },
  { id: 'L12', title: 'NIL Collab Chain', cost: 90000, resale: 35000, rep: 3, category: 'Style' },
  { id: 'L13', title: 'Beach Resort with Friends', cost: 55000, resale: 25000, rep: 2, category: 'Travel' },
  { id: 'L14', title: 'Personal Chef', cost: 40000, resale: 18000, rep: 2, category: 'Lifestyle' },
  { id: 'L15', title: 'NIL Media Photoshoot', cost: 30000, resale: 12000, rep: 1, category: 'Career/Brand' },
  { id: 'L16', title: 'Nightclub Bottle Service', cost: 25000, resale: 10000, rep: 1, category: 'Event' },
  { id: 'L17', title: 'Custom Suit', cost: 18000, resale: 9000, rep: 1, category: 'Style' },
  { id: 'L18', title: 'NIL Merch Line (Vanity Launch)', cost: 75000, resale: 30000, rep: 2, category: 'Business/Flex' },
  { id: 'L19', title: 'Studio Recording Time', cost: 40000, resale: 18000, rep: 2, category: 'Lifestyle' },
  { id: 'L20', title: 'Viral Hype House Party', cost: 50000, resale: 20000, rep: 2, category: 'Event' },
  { id: 'L21', title: 'NIL Graphic Branding Pack', cost: 25000, resale: 12000, rep: 1, category: 'Career/Brand' },
  { id: 'L22', title: 'Designer Backpack Collab', cost: 30000, resale: 12000, rep: 1, category: 'Style' },
  { id: 'L23', title: 'NIL Giveaway Campaign', cost: 40000, resale: 15000, rep: 1, category: 'Social Flex' },
  { id: 'L24', title: 'NIL Promo Van Wrap', cost: 55000, resale: 22000, rep: 2, category: 'Brand/Flex' },
  { id: 'L25', title: 'Hair & Grooming Sponsorship', cost: 10000, resale: 4000, rep: 1, category: 'Style' },
  { id: 'L26', title: 'Tricked-Out Car', cost: 70000, resale: 30000, rep: 2, category: 'Vehicle' },
  { id: 'L27', title: 'NIL Weekend Mansion Rental', cost: 85000, resale: 35000, rep: 2, category: 'Flex/Travel' },
  { id: 'L28', title: 'Home Studio Setup', cost: 45000, resale: 20000, rep: 2, category: 'Content' },
  { id: 'L29', title: 'NIL Room Makeover Collab', cost: 30000, resale: 12000, rep: 1, category: 'Lifestyle' },
  { id: 'L30', title: 'NIL Sneaker Wall Display', cost: 20000, resale: 8000, rep: 1, category: 'Style' },
  { id: 'L31', title: 'Influencer Fitness Challenge', cost: 50000, resale: 20000, rep: 2, category: 'Fitness/Brand' },
  { id: 'L32', title: 'NIL Entrepreneur Podcast', cost: 65000, resale: 25000, rep: 2, category: 'Career/Brand' },
  { id: 'L33', title: 'NIL Mini Doc (Self-Funded)', cost: 100000, resale: 40000, rep: 3, category: 'Brand/Content' },
  { id: 'L34', title: 'NIL Tour Bus for Branding', cost: 150000, resale: 50000, rep: 4, category: 'Lifestyle/Brand' },
  { id: 'L35', title: 'Personal Videographer', cost: 60000, resale: 25000, rep: 2, category: 'Brand/Content' },
  { id: 'L36', title: 'Custom NIL Chain & Jacket Set', cost: 90000, resale: 35000, rep: 3, category: 'Style' },
  { id: 'L37', title: 'NIL Themed Cake & Photoshoot', cost: 12000, resale: 5000, rep: 1, category: 'Lifestyle' },
  { id: 'L38', title: 'NIL Drone Footage Package', cost: 40000, resale: 15000, rep: 1, category: 'Content' },
  { id: 'L39', title: 'NIL Flex Room Decor Setup', cost: 20000, resale: 8000, rep: 1, category: 'Style/Flex' },
  { id: 'L40', title: 'Full Social Media Rebrand', cost: 40000, resale: 18000, rep: 2, category: 'Brand/Image' },
  { id: 'L41', title: 'Down Payment on Exotic Car (Lease)', cost: 90000, resale: 35000, rep: 3, category: 'Vehicle' },
  { id: 'L42', title: 'NIL Giveaway (Cash, Consoles, Sneakers)', cost: 45000, resale: 20000, rep: 2, category: 'Social Flex' },
  { id: 'L43', title: 'Limited Streetwear Drop Buyout', cost: 50000, resale: 25000, rep: 2, category: 'Style' },
  { id: 'L44', title: 'Rapper Music Collab Feature', cost: 60000, resale: 25000, rep: 2, category: 'Content/Flex' },
  { id: 'L45', title: 'NIL Billboard Buyout', cost: 75000, resale: 30000, rep: 3, category: 'Brand/Flex' },
  { id: 'L46', title: 'NIL Influencer Trip to LA', cost: 65000, resale: 25000, rep: 2, category: 'Travel/Social' },
  { id: 'L47', title: 'College Game Tunnel Fit Session', cost: 40000, resale: 18000, rep: 2, category: 'Style/Flex' },
  { id: 'L48', title: 'NIL Brand x Sneaker Store Pop-Up', cost: 55000, resale: 25000, rep: 2, category: 'Flex/Marketing' },
  { id: 'L49', title: 'NIL Signature Backpack Line', cost: 35000, resale: 15000, rep: 1, category: 'Style/Brand' },
  { id: 'L50', title: 'Signature NIL Candle/Fragrance Line', cost: 30000, resale: 12000, rep: 1, category: 'Lifestyle' },
  
  // =====================================================
  // LUXURY DECK EXPANSION - FINAL VERSION
  // =====================================================
  
  // 1. STYLE
  { id: 'L51', title: 'Custom Sneaker Drop - Local Release', cost: 5000, resale: 0, rep: 1, category: 'Style' },
  { id: 'L52', title: 'Custom Sneaker Drop - Regional Release', cost: 10000, resale: 0, rep: 1, category: 'Style' },
  { id: 'L53', title: 'Custom Sneaker Drop - National Release', cost: 25000, resale: 0, rep: 2, category: 'Style' },
  { id: 'L54', title: 'Signature Backpack - Limited Run', cost: 3500, resale: 0, rep: 1, category: 'Style' },
  { id: 'L55', title: 'Signature Backpack - Regional Drop', cost: 15000, resale: 0, rep: 1, category: 'Style' },
  { id: 'L56', title: 'Signature Backpack - National Drop', cost: 35000, resale: 0, rep: 2, category: 'Style' },
  { id: 'L57', title: 'Gold Grill', cost: 5000, resale: 0, rep: 1, category: 'Style' },
  { id: 'L58', title: 'Platinum Grill', cost: 15000, resale: 0, rep: 1, category: 'Style' },
  { id: 'L59', title: 'Diamond-Platinum Grill', cost: 25000, resale: 0, rep: 2, category: 'Style' },
  { id: 'L60', title: 'Diamond Jewelry Set', cost: 60000, resale: 0, rep: 2, category: 'Style' },
  { id: 'L61', title: 'Entry Luxury Watch', cost: 5000, resale: 0, rep: 1, category: 'Style' },
  { id: 'L62', title: 'Mid-Tier Watch', cost: 10000, resale: 0, rep: 1, category: 'Style' },
  { id: 'L63', title: 'Premium Watch Collection', cost: 25000, resale: 0, rep: 2, category: 'Style' },
  { id: 'L64', title: 'Elite Watch Collection', cost: 75000, resale: 0, rep: 3, category: 'Style' },
  
  // 2. VEHICLE
  { id: 'L65', title: 'Executive Sedan', cost: 30000, resale: 0, rep: 2, category: 'Vehicle' },
  { id: 'L66', title: 'Luxury SUV', cost: 50000, resale: 0, rep: 2, category: 'Vehicle' },
  { id: 'L67', title: 'Exotic Supercar - Entry Model', cost: 90000, resale: 0, rep: 3, category: 'Vehicle' },
  { id: 'L68', title: 'Exotic Supercar - Performance Model', cost: 150000, resale: 0, rep: 3, category: 'Vehicle' },
  { id: 'L69', title: 'Exotic Supercar - Limited Edition', cost: 250000, resale: 0, rep: 4, category: 'Vehicle' },
  { id: 'L70', title: 'Weekend Exotic Rental', cost: 30000, resale: 0, rep: 2, category: 'Vehicle' },
  { id: 'L71', title: 'Personal Driver (Annual Contract)', cost: 50000, resale: 0, rep: 2, category: 'Vehicle' },
  
  // 3. TRAVEL
  { id: 'L72', title: 'Private Flight for Two', cost: 12000, resale: 0, rep: 1, category: 'Travel' },
  { id: 'L73', title: 'Private Flight (Small Group of 5)', cost: 30000, resale: 0, rep: 2, category: 'Travel' },
  { id: 'L74', title: 'Domestic First-Class', cost: 4000, resale: 0, rep: 1, category: 'Travel' },
  { id: 'L75', title: 'International First-Class', cost: 12000, resale: 0, rep: 1, category: 'Travel' },
  { id: 'L76', title: 'Beach Resort Experience - Weekend Getaway', cost: 3500, resale: 0, rep: 1, category: 'Travel' },
  { id: 'L77', title: 'Beach Resort Experience - Luxury Resort Stay', cost: 10000, resale: 0, rep: 1, category: 'Travel' },
  { id: 'L78', title: 'Beach Resort Experience - Premium Beach Retreat', cost: 30000, resale: 0, rep: 2, category: 'Travel' },
  { id: 'L79', title: 'Beach Resort Experience - Elite Resort Experience', cost: 55000, resale: 0, rep: 2, category: 'Travel' },
  { id: 'L80', title: 'Mansion Rental - Estate Weekend', cost: 15000, resale: 0, rep: 1, category: 'Travel' },
  { id: 'L81', title: 'Mansion Rental - Luxury Mansion', cost: 30000, resale: 0, rep: 2, category: 'Travel' },
  { id: 'L82', title: 'Mansion Rental - Ultra-Elite Mansion', cost: 50000, resale: 0, rep: 2, category: 'Travel' },
  { id: 'L83', title: 'Cruise Experience - Weekend Cruise', cost: 6000, resale: 0, rep: 1, category: 'Travel' },
  { id: 'L84', title: 'Cruise Experience - Premium Cruise', cost: 18000, resale: 0, rep: 1, category: 'Travel' },
  { id: 'L85', title: 'Private Island Experience', cost: 120000, resale: 0, rep: 3, category: 'Travel' },
  
  // 4. BRAND IMAGE
  { id: 'L86', title: 'Social Media Rebrand - Basic Refresh', cost: 10000, resale: 0, rep: 1, category: 'Brand Image' },
  { id: 'L87', title: 'Social Media Rebrand - Professional Rebrand', cost: 20000, resale: 0, rep: 1, category: 'Brand Image' },
  { id: 'L88', title: 'Social Media Rebrand - Strategic Repositioning', cost: 40000, resale: 0, rep: 2, category: 'Brand Image' },
  { id: 'L89', title: 'Social Media Rebrand - Elite Brand Overhaul', cost: 100000, resale: 0, rep: 3, category: 'Brand Image' },
  { id: 'L90', title: 'Annual Professional Content Team', cost: 60000, resale: 0, rep: 2, category: 'Brand Image' },
  { id: 'L91', title: 'Documentary Feature Production', cost: 75000, resale: 0, rep: 3, category: 'Brand Image' },
  { id: 'L92', title: 'Feature Magazine Spread', cost: 60000, resale: 0, rep: 2, category: 'Brand Image' },
  
  // 5. FLEX MARKETING
  { id: 'L93', title: 'NIL Promo Van Wrap', cost: 5000, resale: 0, rep: 1, category: 'Flex Marketing' },
  { id: 'L94', title: 'Billboard Campaign - Local Billboard', cost: 20000, resale: 0, rep: 1, category: 'Flex Marketing' },
  { id: 'L95', title: 'Billboard Campaign - Regional Billboard', cost: 40000, resale: 0, rep: 2, category: 'Flex Marketing' },
  { id: 'L96', title: 'National Digital Ad Campaign', cost: 120000, resale: 0, rep: 3, category: 'Flex Marketing' },
  { id: 'L97', title: 'Influencer Tour Activation', cost: 95000, resale: 0, rep: 3, category: 'Flex Marketing' },
  
  // 6. SOCIAL FLEX (Community Impact)
  { id: 'L98', title: 'Toy Drive - Local Drive', cost: 7500, resale: 0, rep: 1, category: 'Social Flex' },
  { id: 'L99', title: 'Toy Drive - Citywide Drive', cost: 20000, resale: 0, rep: 1, category: 'Social Flex' },
  { id: 'L100', title: 'Holiday Food Drive - Local Drive', cost: 5000, resale: 0, rep: 1, category: 'Social Flex' },
  { id: 'L101', title: 'Holiday Food Drive - Multi-Neighborhood Campaign', cost: 15000, resale: 0, rep: 1, category: 'Social Flex' },
  { id: 'L102', title: 'Scholarship Fundraiser - Local Event', cost: 12000, resale: 0, rep: 1, category: 'Social Flex' },
  { id: 'L103', title: 'Scholarship Fundraiser - Citywide Gala', cost: 35000, resale: 0, rep: 2, category: 'Social Flex' },
  { id: 'L104', title: 'Community Center Sponsorship', cost: 75000, resale: 0, rep: 3, category: 'Social Flex' },
  { id: 'L105', title: 'Youth Sports Facility Naming Rights', cost: 150000, resale: 0, rep: 3, category: 'Social Flex' },
  
  // 7. ACCESS LUXURY
  { id: 'L106', title: 'Private Membership Club - Entry Tier', cost: 15000, resale: 0, rep: 1, category: 'Access Luxury' },
  { id: 'L107', title: 'Private Membership Club - Executive Tier', cost: 40000, resale: 0, rep: 2, category: 'Access Luxury' },
  { id: 'L108', title: 'Private Membership Club - Elite Tier', cost: 100000, resale: 0, rep: 3, category: 'Access Luxury' },
  { id: 'L109', title: 'Elite Golf Membership', cost: 35000, resale: 0, rep: 2, category: 'Access Luxury' },
  { id: 'L110', title: 'VIP Annual Event Access Pass', cost: 25000, resale: 0, rep: 2, category: 'Access Luxury' },
  
  // 8. OWNERSHIP FLEX
  { id: 'L111', title: 'Partial Restaurant Ownership', cost: 150000, resale: 0, rep: 3, category: 'Ownership Flex' },
  { id: 'L112', title: 'Nightclub Ownership Stake', cost: 120000, resale: 0, rep: 3, category: 'Ownership Flex' },
  { id: 'L113', title: 'Creative Studio Ownership', cost: 100000, resale: 0, rep: 3, category: 'Ownership Flex' },
  
  // 9. SECURITY & PRIVACY
  { id: 'L114', title: 'Executive Security Detail', cost: 80000, resale: 0, rep: 3, category: 'Security & Privacy' },
  { id: 'L115', title: 'Gated Estate Upgrade', cost: 200000, resale: 0, rep: 4, category: 'Security & Privacy' },
  
  // 10. PERFORMANCE LUXURY
  { id: 'L116', title: 'Home Gym Buildout - Base Setup', cost: 25000, resale: 0, rep: 2, category: 'Performance Luxury' },
  { id: 'L117', title: 'Home Gym Buildout - Elite Setup', cost: 60000, resale: 0, rep: 2, category: 'Performance Luxury' },
  { id: 'L118', title: 'Private Performance Trainer (Annual)', cost: 30000, resale: 0, rep: 2, category: 'Performance Luxury' },
  { id: 'L119', title: 'Peak Performance Coach', cost: 20000, resale: 0, rep: 1, category: 'Performance Luxury' },
  
  // 11. TIME LUXURY
  { id: 'L120', title: 'Executive Assistant', cost: 50000, resale: 0, rep: 2, category: 'Time Luxury' },
  { id: 'L121', title: 'Sabbatical Year Experience', cost: 100000, resale: 0, rep: 3, category: 'Time Luxury' },
  { id: 'L122', title: 'Helicopter Commuting Package', cost: 120000, resale: 0, rep: 3, category: 'Time Luxury' },
  
  // 12. FAMILY / LOYALTY FLEX
  { id: 'L123', title: "Parents' Home Renovation - Upgrade Package", cost: 30000, resale: 0, rep: 2, category: 'Family / Loyalty Flex' },
  { id: 'L124', title: "Parents' Home Renovation - Full Renovation", cost: 75000, resale: 0, rep: 3, category: 'Family / Loyalty Flex' },
  { id: 'L125', title: 'Family Vehicle Upgrade', cost: 40000, resale: 0, rep: 2, category: 'Family / Loyalty Flex' },
  { id: 'L126', title: 'Family Education Fund - Contribution Tier 1', cost: 20000, resale: 0, rep: 1, category: 'Family / Loyalty Flex' },
  { id: 'L127', title: 'Family Education Fund - Contribution Tier 2', cost: 50000, resale: 0, rep: 2, category: 'Family / Loyalty Flex' }
];

export default luxuryCards;
