// Mock travel APIs. They behave like real third-party services: variable latency,
// occasional failures (when a fault is injected), and structured JSON responses.

export interface Intent {
  origin: string;
  destination: string;
  days: number;
  travelers: number;
  budget: number;
  month: string;
  interests: string[];
}

export interface Flight { airline: string; flightNo: string; depart: string; stops: number; pricePerPerson: number }
export interface Hotel { name: string; stars: number; area: string; pricePerNight: number; rating: number }
export interface Weather { summary: string; highC: number; lowC: number; rainChance: number }

interface DestInfo { flightBase: number; hotels: Hotel[]; weather: Weather; sights: string[]; foods: string[] }

const CATALOG: Record<string, DestInfo> = {
  tokyo: {
    flightBase: 640,
    hotels: [
      { name: "Shinjuku Granbell", stars: 4, area: "Shinjuku", pricePerNight: 210, rating: 4.5 },
      { name: "Asakusa Riverside Inn", stars: 3, area: "Asakusa", pricePerNight: 120, rating: 4.3 },
      { name: "Park Hyatt Tokyo", stars: 5, area: "Shinjuku", pricePerNight: 690, rating: 4.8 },
    ],
    weather: { summary: "Mild spring, cherry blossoms", highC: 19, lowC: 10, rainChance: 25 },
    sights: ["Senso-ji Temple", "Meiji Shrine", "Shibuya Crossing", "teamLab Planets", "Tsukiji Outer Market"],
    foods: ["ramen in Shinjuku Omoide Yokocho", "sushi at Tsukiji", "monjayaki in Tsukishima"],
  },
  paris: {
    flightBase: 560,
    hotels: [
      { name: "Hôtel Le Marais Lumière", stars: 4, area: "Le Marais", pricePerNight: 240, rating: 4.6 },
      { name: "Montmartre Petit Studio", stars: 3, area: "Montmartre", pricePerNight: 135, rating: 4.2 },
      { name: "Le Meurice", stars: 5, area: "Tuileries", pricePerNight: 980, rating: 4.9 },
    ],
    weather: { summary: "Fresh and breezy", highC: 17, lowC: 8, rainChance: 40 },
    sights: ["Louvre", "Sainte-Chapelle", "Montmartre", "Musée d'Orsay", "Seine cruise"],
    foods: ["croissants at Du Pain et des Idées", "steak frites in Saint-Germain", "falafel on Rue des Rosiers"],
  },
  bali: {
    flightBase: 420,
    hotels: [
      { name: "Ubud Jungle Villas", stars: 4, area: "Ubud", pricePerNight: 140, rating: 4.7 },
      { name: "Canggu Surf Lodge", stars: 3, area: "Canggu", pricePerNight: 70, rating: 4.4 },
      { name: "Four Seasons Sayan", stars: 5, area: "Ubud", pricePerNight: 750, rating: 4.9 },
    ],
    weather: { summary: "Warm, tropical showers", highC: 31, lowC: 24, rainChance: 55 },
    sights: ["Tegallalang Rice Terraces", "Uluwatu Temple", "Sacred Monkey Forest", "Mount Batur sunrise"],
    foods: ["babi guling in Ubud", "nasi campur", "fresh seafood at Jimbaran Bay"],
  },
  dubai: {
    flightBase: 300,
    hotels: [
      { name: "Rove Downtown", stars: 3, area: "Downtown", pricePerNight: 110, rating: 4.4 },
      { name: "Address Sky View", stars: 5, area: "Downtown", pricePerNight: 520, rating: 4.8 },
      { name: "Al Seef Heritage", stars: 4, area: "Al Fahidi", pricePerNight: 180, rating: 4.5 },
    ],
    weather: { summary: "Sunny and hot", highC: 33, lowC: 22, rainChance: 2 },
    sights: ["Burj Khalifa", "Al Fahidi Historic District", "Desert safari", "Dubai Creek abra ride"],
    foods: ["shawarma at Al Mallah", "Emirati machboos", "karak chai at the souk"],
  },
  "new york": {
    flightBase: 780,
    hotels: [
      { name: "Pod Times Square", stars: 3, area: "Midtown", pricePerNight: 190, rating: 4.1 },
      { name: "The Williamsburg Hotel", stars: 4, area: "Brooklyn", pricePerNight: 310, rating: 4.5 },
      { name: "The Plaza", stars: 5, area: "Central Park", pricePerNight: 1100, rating: 4.7 },
    ],
    weather: { summary: "Crisp and clear", highC: 16, lowC: 7, rainChance: 30 },
    sights: ["Central Park", "The Met", "Brooklyn Bridge", "High Line", "Statue of Liberty"],
    foods: ["bagels at Russ & Daughters", "pizza in Brooklyn", "dim sum in Chinatown"],
  },
};

const GENERIC = (dest: string): DestInfo => ({
  flightBase: 500,
  hotels: [
    { name: `${dest} Central Hotel`, stars: 4, area: "City Centre", pricePerNight: 170, rating: 4.4 },
    { name: `${dest} Backpackers Loft`, stars: 2, area: "Old Town", pricePerNight: 60, rating: 4.1 },
    { name: `Grand ${dest} Palace`, stars: 5, area: "Waterfront", pricePerNight: 600, rating: 4.8 },
  ],
  weather: { summary: "Pleasant with a chance of showers", highC: 24, lowC: 15, rainChance: 35 },
  sights: [`${dest} Old Town walk`, `${dest} National Museum`, "local night market", "sunset viewpoint"],
  foods: ["street-food tour", "a chef's tasting menu", "the local breakfast specialty"],
});

export const destInfo = (dest: string) => CATALOG[dest.toLowerCase()] ?? GENERIC(dest);

export class ToolError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (base: number, spread: number) => base + Math.round(Math.random() * spread);

export async function searchFlights(intent: Intent, opts: { slow: boolean; pricey: boolean; speed: number }): Promise<Flight[]> {
  await sleep((opts.slow ? jitter(4000, 600) : jitter(700, 500)) * opts.speed);
  const base = destInfo(intent.destination).flightBase * (opts.pricey ? 1.9 : 1);
  return [
    { airline: "SkyLark Air", flightNo: "SL 214", depart: "08:40", stops: 0, pricePerPerson: Math.round(base * 1.25) },
    { airline: "Nimbus Airways", flightNo: "NB 77", depart: "13:15", stops: 1, pricePerPerson: Math.round(base) },
    { airline: "Comet Connect", flightNo: "CC 9", depart: "23:55", stops: 2, pricePerPerson: Math.round(base * 0.85) },
  ];
}

export async function searchHotels(intent: Intent, opts: { failThisCall: boolean; pricey: boolean; maxPrice?: number; speed: number }): Promise<Hotel[]> {
  await sleep(jitter(600, 600) * opts.speed);
  if (opts.failThisCall) throw new ToolError(503, "HotelHub API: 503 Service Unavailable (upstream timeout)");
  let hotels = destInfo(intent.destination).hotels.map((h) => ({ ...h, pricePerNight: Math.round(h.pricePerNight * (opts.pricey ? 1.8 : 1)) }));
  if (opts.maxPrice) hotels = hotels.filter((h) => h.pricePerNight <= opts.maxPrice!);
  return hotels.sort((a, b) => b.rating - a.rating);
}

export async function getForecast(intent: Intent, opts: { speed: number }): Promise<Weather> {
  await sleep(jitter(450, 400) * opts.speed);
  return destInfo(intent.destination).weather;
}
