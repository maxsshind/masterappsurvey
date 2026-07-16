// config.js — Supabase project constants (master-app "masterstation" project).
// The anon key is public by design (it ships in the master-app web bundle too);
// Row Level Security + the user's login protect the data.
const CONFIG = {
  SUPABASE_URL: "https://kavynghiailoduhulytq.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthdnluZ2hpYWlsb2R1aHVseXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwOTQwNzEsImV4cCI6MjA4MzY3MDA3MX0.vgtfAxmL3Jt6YlpEtPwpOqr3f_-beMSwQFlfNuT0l-M",
  APP_URL: "https://www.sshteam.app",
};

// Submarket → cluster (31→9), mirrors master-app src/lib/types.ts SUBMARKET_TO_CLUSTER.
// A top-level const like CONFIG: shared into background.js via importScripts (same
// worker global scope) and into panel.js via <script src="config.js"> (window global).
const SUBMARKET_TO_CLUSTER = {
  "North Airport": "Airport/South Central",
  "S Airport N of Roeser": "Airport/South Central",
  "S Airport S of Roeser": "Airport/South Central",
  "SC N of Salt River": "Airport/South Central",
  "SC S of Salt River": "Airport/South Central",
  "Central Phoenix": "Airport/South Central",
  "Deer Vly/Pinnacle Pk": "Deer Valley/North Phoenix",
  "Grand Avenue": "West Phoenix/Grand Ave",
  "W Phx N of Thomas Rd": "West Phoenix/Grand Ave",
  "W Phx S of Thomas Rd": "West Phoenix/Grand Ave",
  "North Black Canyon": "West Phoenix/Grand Ave",
  "SW N of Buckeye Road": "Southwest Phoenix/Tolleson",
  "SW S of Buckeye Road": "Southwest Phoenix/Tolleson",
  "Tolleson": "Southwest Phoenix/Tolleson",
  "Chandler N/Gilbert": "Southeast Valley",
  "Mesa": "Southeast Valley",
  "Mesa East": "Southeast Valley",
  "Falcon Fld/Apache Jct": "Southeast Valley",
  "Chandler": "Southeast Valley",
  "Chandler Airport": "Southeast Valley",
  "Glendale": "Far West Valley",
  "Goodyear": "Far West Valley",
  "Surprise": "Far West Valley",
  "Southwest Outlying": "Far West Valley",
  "Tempe East": "Tempe",
  "Tempe Northwest": "Tempe",
  "Tempe Southwest": "Tempe",
  "South Tempe/Ahwatukee": "Tempe",
  "Scottsdale Airpark": "Scottsdale",
  "Scottsdale/Salt River": "Scottsdale",
  "Pinal County": "Pinal County",
};
