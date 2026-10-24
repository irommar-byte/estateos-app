import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PEOPLE_PATH =
  process.env.CDA_HD_PEOPLE_PATH || path.join(__dirname, "data", "cda-hd-people-index.json");
const CDA_HD_BASE = (process.env.CDA_HD_BASE || "https://cda-hd.cc").replace(/\/$/, "");

const QUERY_ALIASES = {
  sylwester: ["sylvester"],
  sylvester: ["sylwester"],
  sly: ["sylvester"],
  kate: ["katherine", "catherine"],
  katherine: ["kate"],
  tomas: ["thomas"],
  thomas: ["tomas"],
  jan: ["john"],
  john: ["jan"],
  piotr: ["peter"],
  peter: ["piotr"],
  michal: ["michael"],
  michael: ["michal"],
  robert: ["bob"],
};

const PEOPLE_SEED = [
  ["Leonardo DiCaprio", "leonardo-dicaprio"],
  ["Kate Winslet", "kate-winslet"],
  ["Sylvester Stallone", "sylvester-stallone", ["sylwester stallone", "sly stallone"]],
  ["Roger Moore", "roger-moore"],
  ["Sean Connery", "sean-connery"],
  ["Daniel Craig", "daniel-craig"],
  ["Pierce Brosnan", "pierce-brosnan"],
  ["Timothy Dalton", "timothy-dalton"],
  ["Tom Cruise", "tom-cruise"],
  ["Tom Hanks", "tom-hanks"],
  ["Brad Pitt", "brad-pitt"],
  ["Angelina Jolie", "angelina-jolie"],
  ["Scarlett Johansson", "scarlett-johansson"],
  ["Keanu Reeves", "keanu-reeves"],
  ["Keanu Reeves", "keanu-reeves"],
  ["Natalie Portman", "natalie-portman"],
  ["Meryl Streep", "meryl-streep"],
  ["Robert De Niro", "robert-de-niro"],
  ["Al Pacino", "al-pacino"],
  ["Morgan Freeman", "morgan-freeman"],
  ["Denzel Washington", "denzel-washington"],
  ["Will Smith", "will-smith"],
  ["Johnny Depp", "johnny-depp"],
  ["Harrison Ford", "harrison-ford"],
  ["Arnold Schwarzenegger", "arnold-schwarzenegger"],
  ["Bruce Willis", "bruce-willis"],
  ["Jason Statham", "jason-statham"],
  ["Dwayne Johnson", "dwayne-johnson", ["the rock"]],
  ["Chris Hemsworth", "chris-hemsworth"],
  ["Chris Evans", "chris-evans"],
  ["Robert Downey Jr.", "robert-downey-jr"],
  ["Samuel L. Jackson", "samuel-l-jackson"],
  ["Matt Damon", "matt-damon"],
  ["Ben Affleck", "ben-affleck"],
  ["Christian Bale", "christian-bale"],
  ["Heath Ledger", "heath-ledger"],
  ["Joaquin Phoenix", "joaquin-phoenix"],
  ["Cillian Murphy", "cillian-murphy"],
  ["Timothée Chalamet", "timothee-chalamet"],
  ["Zendaya", "zendaya"],
  ["Margot Robbie", "margot-robbie"],
  ["Ryan Gosling", "ryan-gosling"],
  ["Ryan Reynolds", "ryan-reynolds"],
  ["Hugh Jackman", "hugh-jackman"],
  ["Nicole Kidman", "nicole-kidman"],
  ["Charlize Theron", "charlize-theron"],
  ["Sandra Bullock", "sandra-bullock"],
  ["Julia Roberts", "julia-roberts"],
  ["Anne Hathaway", "anne-hathaway"],
  ["Emma Stone", "emma-stone"],
  ["Emma Watson", "emma-watson"],
  ["Jennifer Lawrence", "jennifer-lawrence"],
  ["Gal Gadot", "gal-gadot"],
  ["Keira Knightley", "keira-knightley"],
  ["Audrey Hepburn", "audrey-hepburn"],
  ["Marilyn Monroe", "marilyn-monroe"],
  ["Clint Eastwood", "clint-eastwood"],
  ["Steve McQueen", "steve-mcqueen"],
  ["Paul Newman", "paul-newman"],
  ["Jack Nicholson", "jack-nicholson"],
  ["Anthony Hopkins", "anthony-hopkins"],
  ["Ian McKellen", "ian-mckellen"],
  ["Patrick Stewart", "patrick-stewart"],
  ["Benedict Cumberbatch", "benedict-cumberbatch"],
  ["Tom Hardy", "tom-hardy"],
  ["Idris Elba", "idris-elba"],
  ["Michael Fassbender", "michael-fassbender"],
  ["Javier Bardem", "javier-bardem"],
  ["Penélope Cruz", "penelope-cruz"],
  ["Antonio Banderas", "antonio-banderas"],
  ["Jean Reno", "jean-reno"],
  ["Gérard Depardieu", "gerard-depardieu"],
  ["Monica Bellucci", "monica-bellucci"],
  ["Mads Mikkelsen", "mads-mikkelsen"],
  ["Gary Oldman", "gary-oldman"],
  ["Ralph Fiennes", "ralph-fiennes"],
  ["Liam Neeson", "liam-neeson"],
  ["Russell Crowe", "russell-crowe"],
  ["Hugh Grant", "hugh-grant"],
  ["Colin Firth", "colin-firth"],
  ["Kate Blanchett", "cate-blanchett"],
  ["Cate Blanchett", "cate-blanchett"],
  ["Viola Davis", "viola-davis"],
  ["Octavia Spencer", "octavia-spencer"],
  ["Mahershala Ali", "mahershala-ali"],
  ["Adam Driver", "adam-driver"],
  ["Oscar Isaac", "oscar-isaac"],
  ["Pedro Pascal", "pedro-pascal"],
  ["Anya Taylor-Joy", "anya-taylor-joy"],
  ["Florence Pugh", "florence-pugh"],
  ["Saoirse Ronan", "saoirse-ronan"],
  ["Winona Ryder", "winona-ryder"],
  ["Helena Bonham Carter", "helena-bonham-carter"],
  ["Helena Bonham Carter", "helena-bonham-carter"],
  ["Keanu Reeves", "keanu-reeves"],
  ["Laurence Fishburne", "laurence-fishburne"],
  ["Carrie-Anne Moss", "carrie-anne-moss"],
  ["Hugo Weaving", "hugo-weaving"],
  ["Viggo Mortensen", "viggo-mortensen"],
  ["Elijah Wood", "elijah-wood"],
  ["Orlando Bloom", "orlando-bloom"],
  ["Liv Tyler", "liv-tyler"],
  ["Kate Beckinsale", "kate-beckinsale"],
  ["Uma Thurman", "uma-thurman"],
  ["John Travolta", "john-travolta"],
  ["Samuel L. Jackson", "samuel-l-jackson"],
  ["Quentin Tarantino", "quentin-tarantino", null, "Reżyser"],
  ["Christopher Nolan", "christopher-nolan", null, "Reżyser"],
  ["Steven Spielberg", "steven-spielberg", null, "Reżyser"],
  ["James Cameron", "james-cameron", null, "Reżyser"],
  ["Martin Scorsese", "martin-scorsese", null, "Reżyser"],
  ["Ridley Scott", "ridley-scott", null, "Reżyser"],
  ["David Fincher", "david-fincher", null, "Reżyser"],
  ["Quentin Tarantino", "quentin-tarantino", null, "Reżyser"],
  ["Denis Villeneuve", "denis-villeneuve", null, "Reżyser"],
  ["Greta Gerwig", "greta-gerwig", null, "Reżyser"],
  ["Sofia Coppola", "sofia-coppola", null, "Reżyser"],
  ["Bogusław Linda", "boguslaw-linda"],
  ["Cezary Pazura", "cezary-pazura"],
  ["Marek Kondrat", "marek-kondrat"],
  ["Janusz Gajos", "janusz-gajos"],
  ["Krystyna Janda", "krystyna-janda"],
  ["Agnieszka Holland", "agnieszka-holland", null, "Reżyser"],
  ["Andrzej Wajda", "andrzej-wajda", null, "Reżyser"],
  ["Roman Polański", "roman-polanski", ["roman polanski"], "Reżyser"],
];

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function queryNeedles(query) {
  const q = normalizeSearchText(query);
  if (!q) return [];
  const extra = QUERY_ALIASES[q] || [];
  return [...new Set([q, ...extra.map(normalizeSearchText)])];
}

function personUrl(slug, role) {
  const folder = role === "Reżyser" ? "director" : "star";
  return `${CDA_HD_BASE}/${folder}/${slug}/`;
}

/** @type {Map<string, { name: string, url: string, role: string, thumbnail: string, aliases: string[] }>} */
const people = new Map();
let loaded = false;
let saveTimer = null;

function rememberRaw(entry) {
  const url = String(entry?.url || "").replace(/\/$/, "") + (entry?.url ? "/" : "");
  const name = String(entry?.name || "").replace(/\s*[–—-]\s*(Stars?|Director|Reżyser).*/i, "").trim();
  if (!name || !url || !/\/(star|director|tvshows-cast|tvshows-creator)\//i.test(url)) return;
  const role = entry.role || (/\/director\//i.test(url) ? "Reżyser" : "Aktor");
  const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
  const prev = people.get(url);
  people.set(url, {
    name: name.length >= (prev?.name.length || 0) ? name : prev.name,
    url,
    role: prev?.role === "Aktor" ? "Aktor" : role,
    thumbnail: entry.thumbnail || prev?.thumbnail || "",
    aliases: [...new Set([...(prev?.aliases || []), ...aliases])],
  });
}

function seedPeople() {
  for (const row of PEOPLE_SEED) {
    const [name, slug, aliases, role] = row;
    rememberRaw({
      name,
      url: personUrl(slug, role || "Aktor"),
      role: role || "Aktor",
      aliases: aliases || [],
    });
  }
}

function loadPeople() {
  if (loaded) return;
  loaded = true;
  seedPeople();
  try {
    if (!fs.existsSync(PEOPLE_PATH)) return;
    const parsed = JSON.parse(fs.readFileSync(PEOPLE_PATH, "utf8"));
    for (const row of parsed?.people || []) rememberRaw(row);
  } catch {
    /* keep seed */
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(PEOPLE_PATH), { recursive: true });
      const rows = [...people.values()].map(({ name, url, role, thumbnail, aliases }) => ({
        name,
        url,
        role,
        thumbnail,
        aliases,
      }));
      fs.writeFileSync(PEOPLE_PATH, JSON.stringify({ updatedAt: Date.now(), people: rows }) + "\n");
    } catch {
      /* ignore */
    }
  }, 1500);
  if (typeof saveTimer.unref === "function") saveTimer.unref();
}

export function rememberPerson(entry) {
  loadPeople();
  const before = people.size;
  rememberRaw(entry);
  if (people.size !== before) scheduleSave();
}

export function harvestPeople(links, role = "Aktor") {
  if (!Array.isArray(links)) return;
  for (const link of links) {
    rememberPerson({
      name: link?.name,
      url: link?.url,
      role,
      thumbnail: link?.thumbnail,
    });
  }
}

function scorePerson(person, needles) {
  const name = normalizeSearchText(person.name);
  const tokens = name.split(/\s+/).filter(Boolean);
  const aliasText = (person.aliases || []).map(normalizeSearchText).join(" ");
  const slug = normalizeSearchText((person.url || "").split("/").filter(Boolean).pop()?.replace(/-/g, " "));
  let best = 0;
  for (const needle of needles) {
    if (!needle) continue;
    if (name === needle || slug === needle) best = Math.max(best, 200);
    if (tokens.some((token) => token === needle)) best = Math.max(best, 160);
    if (tokens.some((token) => token.startsWith(needle))) best = Math.max(best, 140);
    if (slug.startsWith(needle) || slug.split(/\s+/).some((token) => token.startsWith(needle))) {
      best = Math.max(best, 130);
    }
    if (aliasText.split(/\s+/).some((token) => token === needle || token.startsWith(needle))) {
      best = Math.max(best, 150);
    }
    if (needle.length >= 4 && (name.includes(needle) || slug.includes(needle) || aliasText.includes(needle))) {
      best = Math.max(best, 90);
    }
  }
  return best;
}

export function matchPeople(query, limit = 12) {
  loadPeople();
  const needles = queryNeedles(query);
  if (!needles.length || needles[0].length < 2) return [];
  return [...people.values()]
    .map((person) => ({ person, score: scorePerson(person, needles) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name, "pl"))
    .slice(0, limit)
    .map(({ person }) => ({
      name: person.name,
      url: person.url,
      role: person.role,
      thumbnail: person.thumbnail || "",
    }));
}

export function normalizePersonQuery(value) {
  return normalizeSearchText(value);
}
