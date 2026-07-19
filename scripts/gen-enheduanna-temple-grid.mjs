/**
 * Generate shared/fixtures/layer6/enheduanna-temple-grid.json
 * Run: node scripts/gen-enheduanna-temple-grid.mjs
 *
 * Canonical order: ETCSL t.4.80.1 / Sjöberg–Bergmann TCS 3 colophons
 * ("N lines: the house of DEITY in CITY"). Fragmentary entries stay honest.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'shared', 'fixtures', 'layer6', 'enheduanna-temple-grid.json');

/**
 * @typedef {{
 *   name: string,
 *   city: string,
 *   region: string,
 *   deity: string,
 *   epithet: string | null,
 *   domain: string | null,
 *   rank: 'major' | 'minor' | 'city-patron',
 *   role: 'gateway' | 'junction' | 'terminus' | 'hub' | 'satellite',
 *   funcs: string[],
 *   status?: 'active' | 'unknown' | 'deprecated',
 *   note?: string,
 * }} HymnDef
 */

/** @type {Record<number, HymnDef>} */
const HYMNS = {
  1: {
    name: 'E-engura',
    city: 'Eridu',
    region: 'Sumer',
    deity: 'Enki',
    epithet: 'Lord Nudimmud',
    domain: 'wisdom-waters',
    rank: 'major',
    role: 'gateway',
    funcs: ['wisdom', 'abzu', 'craft'],
  },
  2: {
    name: 'E-kur',
    city: 'Nippur',
    region: 'Sumer',
    deity: 'Enlil',
    epithet: 'Great Mountain',
    domain: 'sovereignty',
    rank: 'major',
    role: 'hub',
    funcs: ['kingship', 'destiny', 'storm'],
  },
  3: {
    name: 'E-Tummal',
    city: 'Nippur',
    region: 'Sumer',
    deity: 'Ninlil',
    epithet: 'Mother Ninlil',
    domain: 'consort-sovereignty',
    rank: 'major',
    role: 'junction',
    funcs: ['consort', 'new-year', 'mediation'],
  },
  4: {
    name: 'E-melem-hush',
    city: 'Nippur',
    region: 'Sumer',
    deity: 'Nuska',
    epithet: 'Counsellor of E-kur',
    domain: 'fire-light',
    rank: 'minor',
    role: 'satellite',
    funcs: ['counsel', 'ordeal', 'messenger'],
  },
  5: {
    name: 'E-shu-me-sha',
    city: 'Nippur',
    region: 'Sumer',
    deity: 'Ninurta',
    epithet: 'Warrior of Enlil',
    domain: 'war-agriculture',
    rank: 'major',
    role: 'junction',
    funcs: ['war', 'plow', 'protection'],
  },
  6: {
    name: 'E-ga-duda',
    city: 'Ga-gi-mah',
    region: 'Sumer',
    deity: 'Shu-zi-ana',
    epithet: 'Junior wife of Enlil',
    domain: 'consort',
    rank: 'minor',
    role: 'satellite',
    funcs: ['chamber', 'consort'],
  },
  7: {
    name: 'E-Kesh',
    city: 'Kesh',
    region: 'Sumer',
    deity: 'Ninhursag',
    epithet: 'Aruru, sister of Enlil',
    domain: 'fertility',
    rank: 'major',
    role: 'hub',
    funcs: ['birth', 'earth', 'form'],
  },
  8: {
    name: 'E-kish-nu-gal',
    city: 'Ur',
    region: 'Sumer',
    deity: 'Nanna',
    epithet: 'Ashimbabbar',
    domain: 'moon-time',
    rank: 'major',
    role: 'hub',
    funcs: ['lunar-cycle', 'city-patron', 'light'],
  },
  9: {
    name: 'E-hursag-Shulgi',
    city: 'Ur',
    region: 'Sumer',
    deity: 'Shulgi',
    epithet: 'Shulgi of An',
    domain: 'royal-cult',
    rank: 'city-patron',
    role: 'junction',
    funcs: ['kingship', 'royal-house'],
    note: 'ETCSL addition: E-hursag of Shulgi in Urim',
  },
  10: {
    name: 'E-Kuara',
    city: 'Kuara',
    region: 'Sumer',
    deity: 'Asarluhhi',
    epithet: 'Son of the abzu',
    domain: 'incantation-war',
    rank: 'city-patron',
    role: 'junction',
    funcs: ['incantation', 'warrior', 'abzu'],
  },
  11: {
    name: 'E-gud-du-shar',
    city: 'Ki-abrig',
    region: 'Sumer',
    deity: 'Ningublaga',
    epithet: 'Son of Nanna',
    domain: 'cattle-cult',
    rank: 'minor',
    role: 'satellite',
    funcs: ['cattle', 'incantation'],
  },
  12: {
    name: 'Kar-zida',
    city: 'Gaesh',
    region: 'Sumer',
    deity: 'Nanna',
    epithet: 'Ashimbabbar',
    domain: 'moon-time',
    rank: 'city-patron',
    role: 'junction',
    funcs: ['moon', 'pure-quay'],
  },
  13: {
    name: 'E-babbar-Larsam',
    city: 'Larsam',
    region: 'Sumer',
    deity: 'Utu',
    epithet: 'Sovereign of E-babbar',
    domain: 'sun-justice',
    rank: 'major',
    role: 'hub',
    funcs: ['sun', 'justice', 'true-word'],
  },
  14: {
    name: 'E-gida',
    city: 'Enegir',
    region: 'Sumer',
    deity: 'Ninazu',
    epithet: 'Sacred one of the underworld',
    domain: 'underworld',
    rank: 'city-patron',
    role: 'junction',
    funcs: ['underworld', 'libation', 'prayer'],
  },
  15: {
    name: 'E-Gishbanda',
    city: 'Gishbanda',
    region: 'Sumer',
    deity: 'Ningishzida',
    epithet: 'Holy one of heaven',
    domain: 'underworld-vegetation',
    rank: 'minor',
    role: 'satellite',
    funcs: ['underworld', 'vegetation'],
  },
  16: {
    name: 'E-ana',
    city: 'Uruk',
    region: 'Sumer',
    deity: 'Inanna',
    epithet: 'Queen of heaven and earth',
    domain: 'love-war',
    rank: 'major',
    role: 'hub',
    funcs: ['love', 'war', 'sovereignty'],
  },
  17: {
    name: 'E-mush',
    city: 'Bad-tibira',
    region: 'Sumer',
    deity: 'Dumuzid',
    epithet: 'Husband of holy Inana',
    domain: 'shepherd-fertility',
    rank: 'city-patron',
    role: 'junction',
    funcs: ['shepherd', 'netherworld', 'fertility'],
  },
  18: {
    name: 'E-akkil',
    city: 'Akkil',
    region: 'Sumer',
    deity: 'Ninshubur',
    epithet: 'True minister of E-ana',
    domain: 'ministry',
    rank: 'minor',
    role: 'satellite',
    funcs: ['minister', 'lamentation'],
  },
  19: {
    name: 'E-Murum',
    city: 'Murum',
    region: 'Sumer',
    deity: 'Ningirim',
    epithet: 'Lady of shining lustration water',
    domain: 'lustration',
    rank: 'minor',
    role: 'satellite',
    funcs: ['incantation', 'lustration'],
  },
  20: {
    name: 'E-ninnu',
    city: 'Lagash',
    region: 'Sumer',
    deity: 'Ningirsu',
    epithet: 'Son of Enlil',
    domain: 'war-storm',
    rank: 'major',
    role: 'hub',
    funcs: ['war', 'storm', 'city-patron'],
  },
  21: {
    name: 'E-Iri-kug',
    city: 'Iri-kug',
    region: 'Sumer',
    deity: 'Bau',
    epithet: 'Mother Bau',
    domain: 'healing-city',
    rank: 'city-patron',
    role: 'junction',
    funcs: ['healing', 'destiny', 'mother'],
  },
  22: {
    name: 'E-Sirara',
    city: 'Sirara',
    region: 'Sumer',
    deity: 'Nanshe',
    epithet: 'Lady of the sea foam',
    domain: 'fisheries-justice',
    rank: 'city-patron',
    role: 'junction',
    funcs: ['sea', 'justice', 'fisheries'],
  },
  23: {
    name: 'E-ab-shaga-la',
    city: 'Gu-aba',
    region: 'Sumer',
    deity: 'Ninmarki',
    epithet: 'Controller of the pure sea',
    domain: 'sea',
    rank: 'city-patron',
    role: 'satellite',
    funcs: ['sea', 'storehouse'],
  },
  24: {
    name: 'E-Kinirsha',
    city: 'Kinirsha',
    region: 'Sumer',
    deity: 'Dumuzid-abzu',
    epithet: 'True wild cow',
    domain: 'abzu-fertility',
    rank: 'minor',
    role: 'satellite',
    funcs: ['song', 'fertility'],
  },
  25: {
    name: 'E-mah-Umma',
    city: 'Umma',
    region: 'Sumer',
    deity: 'Shara',
    epithet: 'Princely son of the Mistress',
    domain: 'city-patron',
    rank: 'city-patron',
    role: 'junction',
    funcs: ['abundance', 'city-patron'],
  },
  26: {
    name: 'E-sherzi-guru',
    city: 'Zabalam',
    region: 'Sumer',
    deity: 'Inanna',
    epithet: 'Great daughter of Suen',
    domain: 'love-war',
    rank: 'city-patron',
    role: 'junction',
    funcs: ['love', 'war', 'evening-star'],
  },
  27: {
    name: 'E-Ishkur',
    city: 'Karkara',
    region: 'Sumer',
    deity: 'Ishkur',
    epithet: 'Canal inspector of heaven and earth',
    domain: 'storm-rain',
    rank: 'city-patron',
    role: 'junction',
    funcs: ['storm', 'rain', 'barley'],
  },
  28: {
    name: 'E-fragmentary-28',
    city: 'Unknown',
    region: 'Sumer',
    deity: 'Unknown',
    epithet: null,
    domain: null,
    rank: 'minor',
    role: 'satellite',
    funcs: [],
    status: 'unknown',
    note: 'ETCSL lines 352–362 fragmentary colophon',
  },
  29: {
    name: 'E-mah-Adab',
    city: 'Adab',
    region: 'Sumer',
    deity: 'Ninhursag',
    epithet: 'Mother Nintur',
    domain: 'fertility',
    rank: 'major',
    role: 'junction',
    funcs: ['birth', 'destiny', 'canal-city'],
    note: 'Also associated with Ashgi as temple prince',
  },
  30: {
    name: 'E-Isin',
    city: 'Isin',
    region: 'Sumer',
    deity: 'Ninisina',
    epithet: 'Great healer of the Land',
    domain: 'healing',
    rank: 'major',
    role: 'hub',
    funcs: ['healing', 'medicine', 'destiny'],
  },
  31: {
    name: 'Kun-satu',
    city: 'Kazallu',
    region: 'Akkad',
    deity: 'Numushda',
    epithet: 'Great lord Numushda',
    domain: 'city-patron',
    rank: 'city-patron',
    role: 'junction',
    funcs: ['mountain-threshold', 'strength'],
  },
  32: {
    name: 'E-igi-kalama',
    city: 'Marda',
    region: 'Akkad',
    deity: 'Lugal-Marda',
    epithet: null,
    domain: 'city-patron',
    rank: 'city-patron',
    role: 'satellite',
    funcs: ['eye-of-land'],
    note: 'ETCSL colophon partly damaged; deity Lugal-Marda standard',
  },
  33: {
    name: 'E-dim-gal-kalama',
    city: 'Der',
    region: 'Akkad',
    deity: 'Ishtaran',
    epithet: 'Sovereign of heaven',
    domain: 'judgment',
    rank: 'city-patron',
    role: 'junction',
    funcs: ['judgment', 'counsel', 'border'],
  },
  34: {
    name: 'E-sikil',
    city: 'Eshnunna',
    region: 'Diyala',
    deity: 'Ninazu',
    epithet: 'Warrior son of Enlil',
    domain: 'war-underworld',
    rank: 'city-patron',
    role: 'junction',
    funcs: ['war', 'pure-house', 'underworld'],
  },
  35: {
    name: 'E-dub',
    city: 'Kish',
    region: 'Sumer',
    deity: 'Zababa',
    epithet: 'Warrior Zababa',
    domain: 'war',
    rank: 'major',
    role: 'hub',
    funcs: ['war', 'city-patron', 'storm'],
  },
  36: {
    name: 'E-gishkeshda-kalama',
    city: 'Gudua',
    region: 'Akkad',
    deity: 'Nergal',
    epithet: 'Meshlamta-ea',
    domain: 'underworld-war',
    rank: 'major',
    role: 'hub',
    funcs: ['underworld', 'war', 'sunset'],
  },
  37: {
    name: 'E-ab-lua',
    city: 'Urum',
    region: 'Akkad',
    deity: 'Suen',
    epithet: 'Ashimbabbar',
    domain: 'moon-time',
    rank: 'city-patron',
    role: 'junction',
    funcs: ['moon', 'judgment', 'cattle'],
  },
  38: {
    name: 'E-babbar-Zimbir',
    city: 'Sippar',
    region: 'Akkad',
    deity: 'Utu',
    epithet: 'Sovereign of E-babbar',
    domain: 'sun-justice',
    rank: 'major',
    role: 'hub',
    funcs: ['sun', 'judgment', 'divine-powers'],
  },
  39: {
    name: 'E-hursag-Ninhursag',
    city: 'Unknown',
    region: 'Sumer',
    deity: 'Ninhursag',
    epithet: 'Midwife of heaven and earth',
    domain: 'fertility',
    rank: 'major',
    role: 'junction',
    funcs: ['birth', 'kingship-crown'],
    status: 'unknown',
    note: 'ETCSL: city name lost; Ninhursaga / Nintur midwife cult',
  },
  40: {
    name: 'E-Ulmas',
    city: 'Ulmas',
    region: 'Akkad',
    deity: 'Inanna',
    epithet: 'Mistress of battle',
    domain: 'love-war',
    rank: 'city-patron',
    role: 'junction',
    funcs: ['battle', 'silver-lapis', 'wisdom'],
  },
  41: {
    name: 'E-Agade',
    city: 'Agade',
    region: 'Akkad',
    deity: 'Aba',
    epithet: 'God of Agade',
    domain: 'imperial-war',
    rank: 'city-patron',
    role: 'terminus',
    funcs: ['battle', 'imperial'],
  },
  42: {
    name: 'E-zagin',
    city: 'Eresh',
    region: 'Sumer',
    deity: 'Nisaba',
    epithet: 'Great Nanibgal',
    domain: 'writing-wisdom',
    rank: 'major',
    role: 'terminus',
    funcs: ['writing', 'wisdom', 'measure'],
    note: 'Colophon: compiler En-hedu-ana; closing signature hymn',
  },
};

const ALPH = 'BCDEFGHIKLMNOPQR';

/** TEMPLE_GRID_LOGOC_V1 weights — frozen into fingerprints for auditability. */
const LOGOC_WEIGHTS = {
  theo: 0.26,
  tech: 0.18,
  cosmo: 0.24,
  coherence: 0.18,
  sovereignty: 0.14,
};

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(1, Math.max(0, n)) * 10000) / 10000;
}

function baselineFrom(channels, weights, penaltySum) {
  const L =
    weights.theo * channels.theo +
    weights.tech * channels.tech +
    weights.cosmo * channels.cosmo +
    weights.coherence * channels.coherence +
    weights.sovereignty * channels.sovereignty -
    penaltySum;
  return clamp01(L);
}

/**
 * Curated-static fingerprint derived from rank/role/status/degree.
 * High-profile hymns get hand-tuned channel bumps.
 */
function buildFingerprint(node, k) {
  const status = node.status;
  const degree = node.cosmo_slots.connectivity.degree;

  let theo = 0.52;
  let tech = 0.68; // shared semantic protocol
  let cosmo = 0.5;
  let coherence = 0.72;
  let sovereignty = 0.78;

  if (k.rank === 'major') {
    theo += 0.28;
    sovereignty += 0.08;
    coherence += 0.06;
  } else if (k.rank === 'city-patron') {
    theo += 0.18;
    sovereignty += 0.04;
  } else {
    theo += 0.08;
  }

  if (k.role === 'hub' || k.role === 'gateway') {
    cosmo += 0.28;
    coherence += 0.1;
  } else if (k.role === 'junction') {
    cosmo += 0.16;
  } else if (k.role === 'terminus') {
    cosmo += 0.12;
    sovereignty += 0.04;
  } else {
    cosmo += 0.06;
  }

  if (degree >= 2) cosmo += 0.06;
  if (degree >= 3) cosmo += 0.04;

  // Hand-tuned landmarks (curated)
  const bumps = {
    1: { theo: 0.06, cosmo: 0.08, coherence: 0.05, conf: 0.93 }, // Eridu gateway
    2: { theo: 0.1, cosmo: 0.08, sovereignty: 0.08, conf: 0.95 }, // Nippur E-kur
    8: { theo: 0.04, cosmo: 0.05, conf: 0.9 }, // Ur Nanna
    16: { theo: 0.12, tech: 0.05, cosmo: 0.08, conf: 0.94 }, // E-ana Inanna
    20: { theo: 0.06, cosmo: 0.06, conf: 0.9 }, // E-ninnu
    42: { theo: 0.08, tech: 0.1, sovereignty: 0.06, conf: 0.96 }, // Nisaba signature
  };
  const b = bumps[node.hymn_index] ?? {};
  theo += b.theo ?? 0;
  tech += b.tech ?? 0;
  cosmo += b.cosmo ?? 0;
  coherence += b.coherence ?? 0;
  sovereignty += b.sovereignty ?? 0;

  let conf = b.conf ?? (k.rank === 'major' ? 0.88 : k.rank === 'city-patron' ? 0.82 : 0.75);

  const penalty_priors = {
    unknownNode: status === 'unknown' ? 0.1 : 0,
    weakConnectivity:
      (k.role === 'hub' || k.role === 'gateway') && degree === 0
        ? 0.08
        : degree === 0 && k.role !== 'satellite'
          ? 0.05
          : degree === 0
            ? 0.03
            : 0.02,
    protocolDrift: 0.03,
    domainImbalance: k.rank === 'minor' ? 0.04 : 0.02,
  };

  if (status === 'unknown') {
    theo *= 0.72;
    cosmo *= 0.72;
    sovereignty *= 0.85;
    coherence *= 0.85;
    conf = Math.min(conf, 0.55);
    penalty_priors.unknownNode = 0.1;
  }

  const channels = {
    theo: clamp01(theo),
    tech: clamp01(tech),
    cosmo: clamp01(cosmo),
    coherence: clamp01(coherence),
    sovereignty: clamp01(sovereignty),
  };
  const P =
    penalty_priors.unknownNode +
    penalty_priors.weakConnectivity +
    penalty_priors.protocolDrift +
    penalty_priors.domainImbalance;

  return {
    profile_id: 'logoc.temple-grid.v1',
    version: '1.0.0',
    channels,
    penalty_priors,
    weights: { ...LOGOC_WEIGHTS },
    baseline_total: baselineFrom(channels, LOGOC_WEIGHTS, P),
    confidence: clamp01(conf),
    provenance: {
      mode: b.conf ? 'curated-static' : 'derived-historical',
      source_refs: [
        'ETCSL:t.4.80.1',
        'TCS-3',
        'TEMPLE_GRID.md',
        'logoc.temple-grid.v1',
      ],
      last_reviewed_at: '2026-07-19',
    },
  };
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function makeNode(i) {
  const k = HYMNS[i];
  if (!k) throw new Error(`missing hymn ${i}`);
  const status = k.status ?? 'active';
  const temple_id =
    status === 'unknown' && k.city === 'Unknown'
      ? `temple-hymn-${String(i).padStart(2, '0')}`
      : `temple-${slug(k.city)}-${slug(k.name)}`;
  const sig = k.note
    ? `Temple Hymn ${i}: ${k.name} — ${k.deity} @ ${k.city}. ${k.note}`
    : `Temple Hymn ${i}: ${k.name} of ${k.deity} at ${k.city} (ETCSL t.4.80.1 / TCS 3)`;

  return {
    temple_id,
    name: k.name,
    deity: {
      deity_id: `deity-${slug(k.deity)}`,
      name: k.deity,
      epithet: k.epithet,
      domain: k.domain,
    },
    city: {
      city_id: `city-${slug(k.city)}`,
      name: k.city,
      region: k.region,
      coordinates: null,
    },
    hymn_index: i,
    theo_slots: {
      rank: k.rank,
      function: k.funcs,
      relationships:
        k.deity === 'Inanna' && i === 16
          ? [{ relation_type: 'rival', target_temple: null, target_deity: 'deity-enlil' }]
          : k.deity === 'Ninlil'
            ? [{ relation_type: 'consort', target_temple: null, target_deity: 'deity-enlil' }]
            : [],
      hymn_signature: sig,
    },
    tech_slots: {
      protocol_version: 'enheduanna-1.0',
      packet_form:
        'sumerian-temple-hymn-envelope: invocation / house-praise / epithet-cluster / colophon-lines',
      naming_profile: {
        canonical_name: k.name,
        variants: [k.name.replace(/-/g, ' ')],
        language: 'Sumerian',
      },
      interoperability_tags: [
        'Sumer',
        'Temple-Hymns-42',
        'ETCSL-t.4.80.1',
        'TCS-3',
        k.city,
        k.deity,
      ].filter((t) => t && t !== 'Unknown'),
    },
    cosmo_slots: {
      grid_layer: 'underlying-grid',
      connectivity: { degree: 0, edges: [] },
      energy_profile:
        k.rank === 'major' ? 'high-intensity-node' : status === 'unknown' ? null : 'standard-node',
      role_in_grid: k.role,
    },
    status,
  };
}

const nodes = [];
for (let i = 1; i <= 42; i++) nodes.push(makeNode(i));

/** Major hub edges on the firmament grid (theological / political / ritual). */
const byName = Object.fromEntries(nodes.map((n) => [n.name, n.temple_id]));
const EDGE_SPEC = [
  ['E-engura', 'E-kur', 'theological', 0.9],
  ['E-kur', 'E-engura', 'theological', 0.9],
  ['E-kur', 'E-Tummal', 'ritual', 0.85],
  ['E-kur', 'E-ana', 'political', 0.7],
  ['E-kish-nu-gal', 'E-kur', 'ritual', 0.75],
  ['E-ana', 'E-kur', 'theological', 0.75],
  ['E-ana', 'E-kish-nu-gal', 'political', 0.55],
  ['E-ninnu', 'E-kur', 'theological', 0.65],
  ['E-babbar-Zimbir', 'E-babbar-Larsam', 'ritual', 0.6],
  ['E-zagin', 'E-kur', 'theological', 0.5],
  ['E-Agade', 'E-Ulmas', 'political', 0.55],
  ['E-Isin', 'E-kur', 'theological', 0.55],
];

for (const n of nodes) {
  const edges = [];
  for (const [from, to, edge_type, weight] of EDGE_SPEC) {
    if (n.name === from && byName[to]) {
      edges.push({ target_temple: byName[to], edge_type, weight });
    }
  }
  n.cosmo_slots.connectivity = { degree: edges.length, edges };
}

// Attach logoc_fingerprint after edges (degree known)
for (const n of nodes) {
  const k = HYMNS[n.hymn_index];
  n.logoc_fingerprint = buildFingerprint(n, k);
}

const slot_mapping = [];
const wheels = ['Teologia', 'Kosmologia', 'Technologia'];
for (const wheel of wheels) {
  for (let s = 0; s < 16; s++) {
    const node = nodes[s];
    slot_mapping.push({
      temple_id: node.temple_id,
      wheel_id: wheel,
      slot_id: ALPH[s],
      weight: node.status === 'active' ? 1.0 : 0.3,
    });
  }
}
// Map remaining hymns 17–42 onto domain wheels with secondary weights (cyclic slots)
for (let i = 16; i < 42; i++) {
  const node = nodes[i];
  const slot = ALPH[i % 16];
  const wheel = wheels[i % 3];
  slot_mapping.push({
    temple_id: node.temple_id,
    wheel_id: wheel,
    slot_id: slot,
    weight: node.status === 'active' ? 0.6 : 0.2,
  });
}

const active = nodes.filter((n) => n.status === 'active').length;
const unknown = nodes.filter((n) => n.status === 'unknown').length;

const grid = {
  $schema: 'https://the-sovereign/ttcl-specs/temple-grid-schema.json',
  grid_id: 'enheduanna-temple-grid',
  schema_version: '1.2.0',
  provenance: {
    author: 'Enheduanna',
    era: 'c. 2300 BCE',
    corpus: 'Temple Hymns (42)',
    source_refs: [
      'ETCSL t.4.80.1 The temple hymns (Oxford)',
      "Sjöberg, Å.W. & Bergmann, E. The Collection of the Sumerian Temple Hymns (TCS 3)",
      'theo-techno-cosmo/Wheel/8 wheels and 3 domains.docx',
      'docs:IV-Grid-of-the-Universe',
    ],
    ttc_domain: 'THEO_TECHNO_COSMO',
  },
  semantics: {
    theology_mode: 'polytheism-networked-system',
    technology_mode: 'semantic-protocol',
    cosmology_mode: 'underlying-grid',
    wheel_binding: {
      bound_wheels: ['Teologia', 'Kosmologia', 'Technologia'],
      rotation_policy: {
        policy_id: 'enheduanna-grid-rotation',
        mode: 'include-all',
        constraints: [
          'all-42-hymns-present',
          'prefer-active-over-unknown',
          'weight-major-hubs-higher',
          'at-least-one-node-per-known-city',
        ],
      },
      slot_mapping,
    },
    ttcl_sign_profile: 'enheduanna-grid-sign-v1',
  },
  binding: {
    sign_profile: 'enheduanna-grid-sign-v1',
    logoc_profile: 'enheduanna-grid-logoc-v1',
    event_profile: 'enheduanna-grid-event-v1',
  },
  nodes,
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(grid, null, 2)}\n`, 'utf8');
console.log(
  `wrote ${out}\n  nodes=${nodes.length} active=${active} unknown=${unknown} edges=${EDGE_SPEC.length} slot_mappings=${slot_mapping.length}`,
);
