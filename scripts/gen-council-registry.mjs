/**
 * Generate theo-techno-cosmo/THE COUNCILE/council-registry.json
 * from curated member metadata + directory scan.
 *
 *   node scripts/gen-council-registry.mjs
 *   node scripts/check-council-registry.mjs
 */
import { readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const councilDir = join(root, 'theo-techno-cosmo', 'THE COUNCILE');
const out = join(councilDir, 'council-registry.json');

/** Curated unique council members (reflection voices, not Steward Council votes). */
const MEMBERS = [
  // Core README set
  {
    member_id: 'ramon-llull',
    display_name: 'Ramon Llull',
    era: '1232–1315',
    ttc_emphasis: ['TECHNOLOGY', 'THEOLOGY', 'COSMOLOGY'],
    contribution: 'Operative wheels, combinatorial logic, Ars Magna',
    key_insight: 'Constraint generates possibility, not limits it',
    file_patterns: [/^RAMON LLULL/i, /llull/i],
  },
  {
    member_id: 'charles-sanders-peirce',
    display_name: 'Charles Sanders Peirce',
    era: '1839–1914',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Semiotics, triadic relations, pragmatism, abduction',
    key_insight: 'Meaning emerges from resonance, not definition',
    file_patterns: [/PEIRCE/i, /peirce/i],
  },
  {
    member_id: 'marcus-aurelius',
    display_name: 'Marcus Aurelius',
    era: '121–180 CE',
    ttc_emphasis: ['THEOLOGY', 'COSMOLOGY'],
    contribution: 'Meditations, Stoic practical philosophy under imperial constraint',
    key_insight: 'Authentic operation within constraint is freedom',
    file_patterns: [/Marcus Aurelius/i],
  },
  {
    member_id: 'johannes-trithemius',
    display_name: 'Johannes Trithemius',
    era: '1462–1516',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Steganographia, cryptography/angelology superposition',
    key_insight: 'Macro–micro patterns validate across domains',
    file_patterns: [/TRITHEMIUS|Trithemius/i],
  },
  {
    member_id: 'jiang-xueqin',
    display_name: 'Jiang Xueqin',
    era: '1976–',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Predictive history, institutional algorithms, elite reproduction',
    key_insight: 'Emanation and institutional filtering appear at every scale',
    file_patterns: [/Jiang Xueqin/i],
  },
  {
    member_id: 'gnostic-jesus',
    display_name: 'Gnostic Jesus',
    era: '1st–2nd century CE (textual tradition)',
    ttc_emphasis: ['THEOLOGY', 'COSMOLOGY'],
    contribution: 'Nag Hammadi mirror-catalyst of systemic self-remembering',
    key_insight: 'True knowledge requires decompression, not instruction',
    file_patterns: [/Gnostic Jesus/i],
  },
  {
    member_id: 'alan-watts',
    display_name: 'Alan Watts',
    era: '1915–1973',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY'],
    contribution: 'Eastern non-dualism × cybernetics / systems translation',
    key_insight: 'Authentic agency emerges from surrendering force-based control',
    file_patterns: [/Alan Watts|ALAN WATTS/i],
  },
  {
    member_id: 'zarathustra',
    display_name: 'Zarathustra',
    era: '~1500–1000 BCE',
    ttc_emphasis: ['THEOLOGY', 'COSMOLOGY'],
    contribution: 'Asha as universal operating system; cosmic polarity',
    key_insight: 'Polarity and constraint as ontological, not accidental',
    file_patterns: [/Zarathustra|ZARATHUSTRA/i],
  },
  // Extended corpus (tracked)
  {
    member_id: 'aristotle',
    display_name: 'Aristotle',
    era: '384–322 BCE',
    ttc_emphasis: ['TECHNOLOGY', 'THEOLOGY', 'COSMOLOGY'],
    contribution: 'Causality, categories, virtue ethics, systematic method',
    key_insight: 'Method and virtue are structural, not ornamental',
    file_patterns: [/ARISTOTLE|Aristotle/i],
  },
  {
    member_id: 'cyrus-the-great',
    display_name: 'Cyrus the Great',
    era: 'c. 600–530 BCE',
    ttc_emphasis: ['THEOLOGY', 'COSMOLOGY'],
    contribution: 'Plural satrapy governance, tolerant layered sovereignty',
    key_insight: 'Unity need not require uniformity',
    file_patterns: [/Cyrus/i],
  },
  {
    member_id: 'king-solomon',
    display_name: 'King Solomon',
    era: 'c. 990–931 BCE',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY'],
    contribution: 'Judgment under ambiguity; wisdom as structural resource',
    key_insight: 'Wisdom is an operational capacity, not a slogan',
    file_patterns: [/King Solomon|Solomon/i],
  },
  {
    member_id: 'niccolo-machiavelli',
    display_name: 'Niccolò Machiavelli',
    era: '1469–1527',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Power-as-it-is, institutional realism',
    key_insight: 'Observing power is never outside power',
    file_patterns: [/Machiavelli/i],
  },
  {
    member_id: 'akhenaten',
    display_name: 'Akhenaten',
    era: 'c. 1353–1336 BCE',
    ttc_emphasis: ['THEOLOGY', 'COSMOLOGY'],
    contribution: 'Aten monotheism, spatial contamination of sacred sites',
    key_insight: 'Geography carries theological memory',
    file_patterns: [/Akhenaten/i],
  },
  {
    member_id: 'baruch-spinoza',
    display_name: 'Baruch Spinoza',
    era: '1632–1677',
    ttc_emphasis: ['THEOLOGY', 'COSMOLOGY'],
    contribution: 'Substance monism, freedom within necessity',
    key_insight: 'Truth may require remaining outside the temple',
    file_patterns: [/Spinoza/i],
  },
  {
    member_id: 'carl-jung',
    display_name: 'Carl Jung',
    era: '1875–1961',
    ttc_emphasis: ['THEOLOGY', 'COSMOLOGY'],
    contribution: 'Individuation, collective unconscious, symbolic architecture',
    key_insight: 'The observer is the site of archetypal decompression',
    file_patterns: [/Carl jung|Jung/i],
  },
  {
    member_id: 'christine-de-pizan',
    display_name: "Christine de Pizan",
    era: '1364–c. 1430',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY'],
    contribution: 'First systematic rewrite of women’s social “source code”',
    key_insight: 'Identity programming can be recognized and rewritten',
    file_patterns: [/Christine de Pizan/i],
  },
  {
    member_id: 'friedrich-nietzsche',
    display_name: 'Friedrich Nietzsche',
    era: '1844–1900',
    ttc_emphasis: ['THEOLOGY', 'COSMOLOGY'],
    contribution: 'Genealogy of morals, perspectivism, self-implicating critique',
    key_insight: 'Perspectivism applies to itself',
    file_patterns: [/Nietzsche/i],
  },
  {
    member_id: 'galileo-galilei',
    display_name: 'Galileo Galilei',
    era: '1564–1642',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Observational science vs authority; method as liberation',
    key_insight: 'Instruments reconfigure what counts as visible truth',
    file_patterns: [/Galileo/i],
  },
  {
    member_id: 'giordano-bruno',
    display_name: 'Giordano Bruno',
    era: '1548–1600',
    ttc_emphasis: ['COSMOLOGY', 'THEOLOGY'],
    contribution: 'Infinite worlds, heretical cosmology',
    key_insight: 'The cosmos exceeds any single firmament',
    file_patterns: [/Bruno/i],
  },
  {
    member_id: 'irenaeus-of-lyon',
    display_name: 'Irenaeus of Lyon',
    era: 'c. 130–202 CE',
    ttc_emphasis: ['THEOLOGY'],
    contribution: 'Anti-Gnostic systematics; orthodoxy as architecture',
    key_insight: 'Boundary-setting is itself a theological technology',
    file_patterns: [/Irenaeus/i],
  },
  {
    member_id: 'mary-magdalene',
    display_name: 'Mary Magdalene',
    era: '1st century CE (Gnostic textual tradition)',
    ttc_emphasis: ['THEOLOGY'],
    contribution: 'Exemplary knower in Gospel of Mary / Pistis Sophia',
    key_insight: 'Gnosis becomes visible through a contested voice in the assembly',
    file_patterns: [/Mary Magdalene/i],
  },
  {
    member_id: 'napoleon-bonaparte',
    display_name: 'Napoleon Bonaparte',
    era: '1769–1821',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Cognitive battlefield; decision architecture of war',
    key_insight: 'The physical battle reveals a decision already made',
    file_patterns: [/Napoleon/i],
  },
  {
    member_id: 'isaac-newton',
    display_name: 'Sir Isaac Newton',
    era: '1642–1727',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY', 'THEOLOGY'],
    contribution: 'Laws of motion; theology of a lawful cosmos',
    key_insight: 'Universal law unifies celestial and terrestrial machinery',
    file_patterns: [/Newton/i],
  },
  {
    member_id: 'sor-juana-ines-de-la-cruz',
    display_name: 'Sor Juana Inés de la Cruz',
    era: '1648–1695',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY'],
    contribution: 'Baroque universal science vs scholastic limits',
    key_insight: 'Knowledge desire collides with institutional envelope',
    file_patterns: [/Sor Juana/i],
  },
  {
    member_id: 'sun-tzu',
    display_name: 'Sun Tzu',
    era: 'c. 544–496 BCE',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Art of War; strategic information and terrain',
    key_insight: 'Victory is structural positioning, not brute force',
    file_patterns: [/Sun Tzu/i],
  },
  {
    member_id: 'thales-of-miletus',
    display_name: 'Thales of Miletus',
    era: 'c. 624–545 BCE',
    ttc_emphasis: ['COSMOLOGY', 'TECHNOLOGY'],
    contribution: 'First principles natural philosophy',
    key_insight: 'Unity of substance underlies plural phenomena',
    file_patterns: [/Thales/i],
  },
  {
    member_id: 'victoria-lady-welby',
    display_name: 'Victoria, Lady Welby',
    era: '1837–1912',
    ttc_emphasis: ['TECHNOLOGY'],
    contribution: 'Significs — technology of meaning',
    key_insight: 'The observer is always the meaning-maker',
    file_patterns: [/Welby/i],
  },
  // Recently added (untracked → system)
  {
    member_id: 'enheduanna',
    display_name: 'Enheduanna',
    era: 'c. 23rd century BCE',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Temple Hymns (42), first named authorship, Grid of the Universe',
    key_insight: 'Polytheism as networked semantic protocol on one underlying grid',
    file_patterns: [/Enheduanna/i],
    recently_added: true,
    system_bindings: [
      {
        kind: 'temple-grid',
        ref: 'shared/fixtures/layer6/enheduanna-temple-grid.json',
      },
    ],
  },
  {
    member_id: 'basilides-of-alexandria',
    display_name: 'Basilides of Alexandria',
    era: 'early 2nd century CE',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Compression/decompression cosmology; Great Ignorance as mercy',
    key_insight: 'Local maxima mistake themselves for global maxima (Archon)',
    file_patterns: [/Basilides/i],
    recently_added: true,
  },
  {
    member_id: 'hatshepsut',
    display_name: 'Hatshepsut',
    era: 'c. 1507–1458 BCE',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Architectural/political legitimacy; iconographic engineering',
    key_insight: 'Legitimacy is manufactured stone-code, not only blood',
    file_patterns: [/Hatshepsut/i],
    recently_added: true,
  },
  {
    member_id: 'hildegard-von-bingen',
    display_name: 'Hildegard von Bingen',
    era: '1098–1179',
    ttc_emphasis: ['THEOLOGY', 'COSMOLOGY', 'TECHNOLOGY'],
    contribution: 'Visions → theological, musical, medical architecture',
    key_insight: 'Latent vision becomes system when finally externalized',
    file_patterns: [/Hildegard/i],
    recently_added: true,
  },
  {
    member_id: 'catherine-de-medici',
    display_name: "Catherine de' Medici",
    era: '1519–1589',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Holding a fracturing kingdom via alliance, spectacle, force',
    key_insight: 'Stewardship under schism is continuous triage, not purity',
    file_patterns: [/Catherine de/i, /Medici/i],
    recently_added: true,
  },
  {
    member_id: 'laura-bassi',
    display_name: 'Laura Bassi',
    era: '1711–1778',
    ttc_emphasis: ['TECHNOLOGY', 'THEOLOGY'],
    contribution: 'First woman university chair in physics (Bologna)',
    key_insight: 'Institutional knowledge machines can be entered and rewired',
    file_patterns: [/Laura Bassi/i],
    recently_added: true,
  },
  {
    member_id: 'mirabai',
    display_name: 'Mirabai',
    era: 'c. 1498–c. 1557',
    ttc_emphasis: ['THEOLOGY'],
    contribution: 'Bhakti radicalism; rejection of caste/marriage orthodoxy',
    key_insight: 'Direct unmediated devotion dissolves inherited architecture',
    file_patterns: [/Mirabai/i],
    recently_added: true,
  },
  {
    member_id: 'queen-of-sheba',
    display_name: 'Queen of Sheba (Makeda)',
    era: 'ancient (multi-tradition)',
    ttc_emphasis: ['THEOLOGY', 'COSMOLOGY'],
    contribution: 'Hebrew / Kebra Nagast / Quran traditions of sovereign testing',
    key_insight: 'Wisdom is verified by encounter, not rumor',
    file_patterns: [/Queen of Sheba|Sheba|Makeda/i],
    recently_added: true,
  },
  {
    member_id: 'zenobia-of-palmyra',
    display_name: 'Zenobia of Palmyra',
    era: 'c. 240–c. 274 CE',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Desert trading empire challenging Rome in the East',
    key_insight: 'Peripheral nodes can temporarily become hubs of order',
    file_patterns: [/Zenobia/i],
    recently_added: true,
  },
];

const files = readdirSync(councilDir).filter((f) => {
  const p = join(councilDir, f);
  return statSync(p).isFile() && f !== 'README.md' && f !== 'council-registry.json';
});

function matchFiles(patterns) {
  return files.filter((f) => patterns.some((re) => re.test(f)));
}

const claimed = new Set();
const members = [];

for (const m of MEMBERS) {
  const source_files = matchFiles(m.file_patterns);
  for (const f of source_files) claimed.add(f);
  members.push({
    member_id: m.member_id,
    display_name: m.display_name,
    era: m.era,
    status: source_files.length ? 'active' : 'stub',
    recently_added: !!m.recently_added,
    ttc_emphasis: m.ttc_emphasis,
    contribution: m.contribution,
    key_insight: m.key_insight,
    source_files,
    system_bindings: m.system_bindings ?? [],
    notes: source_files.length
      ? null
      : 'No matching source file found in THE COUNCILE/',
  });
}

// Unmatched source files (not in curated map)
const orphans = files.filter((f) => !claimed.has(f));
for (const f of orphans) {
  members.push({
    member_id: `unmapped-${f
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48)}`,
    display_name: f.replace(/\.(txt|md)$/i, ''),
    era: 'unknown',
    status: 'extraction',
    recently_added: false,
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Source present; awaiting curated member card',
    key_insight: 'Pending extraction',
    source_files: [f],
    system_bindings: [],
    notes: 'Auto-listed orphan source — add curated MEMBERS entry',
  });
}

members.sort((a, b) => a.display_name.localeCompare(b.display_name));

const registry = {
  $schema: 'https://the-sovereign/ttcl-specs/council-registry.schema.json',
  registry_id: 'the-councile-reflection-v1',
  schema_version: '1.0.0',
  kind: 'council-of-reflection',
  source_dir: 'theo-techno-cosmo/THE COUNCILE',
  description:
    'Historical / contemplative Council of Reflection. Distinct from docs/STEWARD_COUNCIL.md (charter governance).',
  generated_at: new Date().toISOString().slice(0, 10),
  members,
  stats: {
    member_count: members.length,
    source_file_count: files.length,
    recently_added_count: members.filter((m) => m.recently_added).length,
  },
};

writeFileSync(out, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
console.log(
  `wrote ${out}\n  members=${registry.stats.member_count} sources=${registry.stats.source_file_count} recently_added=${registry.stats.recently_added_count}`,
);
const recent = members.filter((m) => m.recently_added).map((m) => m.display_name);
console.log('  recently_added:', recent.join(', '));
