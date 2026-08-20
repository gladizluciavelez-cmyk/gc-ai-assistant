// Lightweight keyword detection for the Bid Opportunities feed — no AI call,
// just substring matching so this is instant and free to run on every page load.

// South Florida municipalities/counties. Each entry is { match, label }:
// match is the phrase we search for (case-insensitive substring), label is
// what actually gets displayed. Order matters — more specific phrases must
// come before less specific ones, e.g. "City of Miami" must be checked
// before the bare "Miami" fallback, and "Miami-Dade County" before that.
// A bare mention of "Miami" with no "City of" prefix is treated as the
// broader Miami-Dade area rather than the specific City of Miami.
const MUNICIPALITIES: { match: string; label: string }[] = [
  { match: "City of Miami", label: "City of Miami" },
  { match: "Unincorporated Miami-Dade", label: "Unincorporated Miami-Dade" },
  { match: "Miami-Dade County", label: "Miami-Dade" },
  { match: "Broward County", label: "Broward County" },
  { match: "Palm Beach County", label: "Palm Beach County" },
  { match: "North Miami Beach", label: "North Miami Beach" },
  { match: "Lauderdale-by-the-Sea", label: "Lauderdale-by-the-Sea" },
  { match: "West Palm Beach", label: "West Palm Beach" },
  { match: "Palm Beach Gardens", label: "Palm Beach Gardens" },
  { match: "Palm Beach Shores", label: "Palm Beach Shores" },
  { match: "Royal Palm Beach", label: "Royal Palm Beach" },
  { match: "North Palm Beach", label: "North Palm Beach" },
  { match: "South Palm Beach", label: "South Palm Beach" },
  { match: "Village of Golf", label: "Village of Golf" },
  { match: "Boynton Beach", label: "Boynton Beach" },
  { match: "Jupiter Inlet Colony", label: "Jupiter Inlet Colony" },
  { match: "Lake Clarke Shores", label: "Lake Clarke Shores" },
  { match: "Lake Worth Beach", label: "Lake Worth Beach" },
  { match: "Hallandale Beach", label: "Hallandale Beach" },
  { match: "Pompano Beach", label: "Pompano Beach" },
  { match: "Deerfield Beach", label: "Deerfield Beach" },
  { match: "Highland Beach", label: "Highland Beach" },
  { match: "Delray Beach", label: "Delray Beach" },
  { match: "Boca Raton", label: "Boca Raton" },
  { match: "Fort Lauderdale", label: "Fort Lauderdale" },
  { match: "Coral Springs", label: "Coral Springs" },
  { match: "Coconut Creek", label: "Coconut Creek" },
  { match: "Cooper City", label: "Cooper City" },
  { match: "Dania Beach", label: "Dania Beach" },
  { match: "Davie", label: "Davie" },
  { match: "Hillsboro Beach", label: "Hillsboro Beach" },
  { match: "Hollywood", label: "Hollywood" },
  { match: "Lauderdale Lakes", label: "Lauderdale Lakes" },
  { match: "Lauderhill", label: "Lauderhill" },
  { match: "Lighthouse Point", label: "Lighthouse Point" },
  { match: "Margate", label: "Margate" },
  { match: "Miramar", label: "Miramar" },
  { match: "North Lauderdale", label: "North Lauderdale" },
  { match: "Oakland Park", label: "Oakland Park" },
  { match: "Parkland", label: "Parkland" },
  { match: "Pembroke Park", label: "Pembroke Park" },
  { match: "Pembroke Pines", label: "Pembroke Pines" },
  { match: "Plantation", label: "Plantation" },
  { match: "Southwest Ranches", label: "Southwest Ranches" },
  { match: "Sunrise", label: "Sunrise" },
  { match: "Tamarac", label: "Tamarac" },
  { match: "Weston", label: "Weston" },
  { match: "West Park", label: "West Park" },
  { match: "Wilton Manors", label: "Wilton Manors" },
  { match: "Atlantis", label: "Atlantis" },
  { match: "Belle Glade", label: "Belle Glade" },
  { match: "Briny Breezes", label: "Briny Breezes" },
  { match: "Cloud Lake", label: "Cloud Lake" },
  { match: "Glen Ridge", label: "Glen Ridge" },
  { match: "Greenacres", label: "Greenacres" },
  { match: "Gulf Stream", label: "Gulf Stream" },
  { match: "Haverhill", label: "Haverhill" },
  { match: "Hypoluxo", label: "Hypoluxo" },
  { match: "Juno Beach", label: "Juno Beach" },
  { match: "Jupiter", label: "Jupiter" },
  { match: "Lake Park", label: "Lake Park" },
  { match: "Lantana", label: "Lantana" },
  { match: "Loxahatchee Groves", label: "Loxahatchee Groves" },
  { match: "Manalapan", label: "Manalapan" },
  { match: "Mangonia Park", label: "Mangonia Park" },
  { match: "Ocean Ridge", label: "Ocean Ridge" },
  { match: "Pahokee", label: "Pahokee" },
  { match: "Palm Beach", label: "Palm Beach" },
  { match: "Riviera Beach", label: "Riviera Beach" },
  { match: "South Bay", label: "South Bay" },
  { match: "Tequesta", label: "Tequesta" },
  { match: "Wellington", label: "Wellington" },
  { match: "Westlake", label: "Westlake" },
  { match: "Miami Beach", label: "Miami Beach" },
  { match: "Coral Gables", label: "Coral Gables" },
  { match: "Hialeah Gardens", label: "Hialeah Gardens" },
  { match: "Hialeah", label: "Hialeah" },
  { match: "Miami Springs", label: "Miami Springs" },
  { match: "North Miami", label: "North Miami" },
  { match: "Opa-locka", label: "Opa-locka" },
  { match: "South Miami", label: "South Miami" },
  { match: "Homestead", label: "Homestead" },
  { match: "Miami Shores", label: "Miami Shores" },
  { match: "Bal Harbour", label: "Bal Harbour" },
  { match: "Bay Harbor Island", label: "Bay Harbor Island" },
  { match: "Surfside", label: "Surfside" },
  { match: "West Miami", label: "West Miami" },
  { match: "Florida City", label: "Florida City" },
  { match: "Biscayne Park", label: "Biscayne Park" },
  { match: "El Portal", label: "El Portal" },
  { match: "Golden Beach", label: "Golden Beach" },
  { match: "Pinecrest", label: "Pinecrest" },
  { match: "Indian Creek", label: "Indian Creek" },
  { match: "Medley", label: "Medley" },
  { match: "North Bay Village", label: "North Bay Village" },
  { match: "Key Biscayne", label: "Key Biscayne" },
  { match: "Sweetwater", label: "Sweetwater" },
  { match: "Virginia Gardens", label: "Virginia Gardens" },
  { match: "Aventura", label: "Aventura" },
  { match: "Islandia", label: "Islandia" },
  { match: "Sunny Isles Beach", label: "Sunny Isles Beach" },
  { match: "Miami Lakes", label: "Miami Lakes" },
  { match: "Palmetto Bay", label: "Palmetto Bay" },
  { match: "Miami Gardens", label: "Miami Gardens" },
  { match: "Doral", label: "Doral" },
  { match: "Cutler Bay", label: "Cutler Bay" },
  // Bare "Miami" with no "City of" prefix — treat as Miami-Dade generally,
  // per how the county/city naming is actually used in practice.
  { match: "Miami", label: "Miami-Dade" },
];

const TRADES: { label: string; keywords: string[] }[] = [
  { label: "Plumbing", keywords: ["plumbing", "plumber"] },
  { label: "Roofing", keywords: ["roofing", "roof replacement", "re-roof"] },
  { label: "Electrical", keywords: ["electrical", "electrician"] },
  { label: "HVAC", keywords: ["hvac", "air conditioning", "mechanical"] },
  { label: "Paving/Asphalt", keywords: ["paving", "asphalt", "resurfacing", "road resurfacing"] },
  { label: "Concrete", keywords: ["concrete", "sidewalk"] },
  { label: "Landscaping", keywords: ["landscap", "irrigation"] },
  { label: "Painting", keywords: ["painting"] },
  { label: "Flooring", keywords: ["flooring"] },
  { label: "Drywall", keywords: ["drywall"] },
  { label: "Masonry", keywords: ["masonry"] },
  { label: "Fencing", keywords: ["fencing", "fence"] },
  { label: "Water/Sewer", keywords: ["water main", "sewer", "utilities"] },
  { label: "Fire Protection", keywords: ["fire protection", "sprinkler"] },
  { label: "Demolition", keywords: ["demolition", "demo of"] },
  { label: "Sitework", keywords: ["sitework", "excavation", "grading"] },
  { label: "General Contracting", keywords: ["general contract", "renovation", "construction of"] },
];

// Phrases that mean "this email is about a bid we already placed" (a
// confirmation/receipt/status update) rather than a new opportunity to
// consider bidding on. These get filtered out of Bid Opportunities so that
// feed stays focused on new invitations like OpenGov notices.
const BID_CONFIRMATION_PHRASES = [
  "bid submitted",
  "bid has been submitted",
  "bid submission confirmation",
  "submission confirmation",
  "your bid",
  "we have received your bid",
  "bid received",
  "proposal submitted",
  "proposal has been submitted",
  "thank you for your submission",
  "successfully submitted",
  "your submission",
  "bid was placed",
  "bid has been placed",
];

export function detectMunicipality(text: string): string | null {
  const lower = text.toLowerCase();
  for (const { match, label } of MUNICIPALITIES) {
    if (lower.includes(match.toLowerCase())) return label;
  }
  return null;
}

export function detectTrade(text: string): string | null {
  const lower = text.toLowerCase();
  for (const trade of TRADES) {
    if (trade.keywords.some((kw) => lower.includes(kw))) return trade.label;
  }
  return null;
}

export function isBidConfirmation(text: string): boolean {
  const lower = text.toLowerCase();
  return BID_CONFIRMATION_PHRASES.some((phrase) => lower.includes(phrase));
}
