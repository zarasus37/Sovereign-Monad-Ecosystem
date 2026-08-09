/**
 * Generate theo-techno-cosmo/THE COUNCILE/council-registry.json
 * from curated member metadata + directory scan.
 * Also writes member substrates (all seats hard-bound) under
 * shared/fixtures/layer6/council-substrates/
 *
 *   node scripts/gen-council-registry.mjs
 *   node scripts/check-council-registry.mjs
 */
import {
  readdirSync,
  writeFileSync,
  existsSync,
  statSync,
  mkdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const councilDir = join(root, 'theo-techno-cosmo', 'THE COUNCILE');
const out = join(councilDir, 'council-registry.json');
const substrateDir = join(root, 'shared', 'fixtures', 'layer6', 'council-substrates');
const substrateIndexPath = join(
  root,
  'shared',
  'fixtures',
  'layer6',
  'council-substrate-index.json',
);

/** Natural domain tags (for substrate runtime; not TempleGrid). */
const NATURAL_DOMAIN = {
  'ramon-llull': 'combinatorial-wheels',
  'charles-sanders-peirce': 'wheel-triad-semiotics',
  'victoria-lady-welby': 'wheel-significs-triad-expansion',
  'johannes-trithemius': 'wheel-macro-micro-correspondence',
  'ramon-llull': 'combinatorial-wheels',
  enheduanna: 'temple-network-grid',
  poimandres: 'hermetic-nous-ascent',
  'gnostic-jesus': 'gnostic-decompression',
  'basilides-of-alexandria': 'compression-archon',
  'kurt-godel': 'formal-incompleteness',
  'alan-turing': 'computability-morphogenesis',
  'john-von-neumann': 'stored-program-games',
  'carl-friedrich-gauss': 'number-geometry-measure',
  'leonhard-euler': 'analysis-notation-graph',
  'ronald-a-fisher': 'experimental-design-selection',
  'isaac-newton': 'universal-lawful-cosmos',
  'albert-einstein': 'spacetime-relativity-quanta',
  'edwin-hubble': 'extragalactic-expansion',
  'galileo-galilei': 'instrumental-visibility',
  'giordano-bruno': 'infinite-worlds',
  'thales-of-miletus': 'first-principles-substance',
  'antoine-lavoisier': 'quantitative-chemistry',
  'charles-darwin': 'descent-natural-selection',
  'vilhelm-bjerknes': 'atmosphere-as-physics',
  'nikola-tesla': 'polyphase-power-transmission',
  hippocrates: 'natural-medicine',
  'adam-smith': 'moral-sentiments-markets',
  'karl-marx': 'critique-political-economy',
  'sigmund-freud': 'unconscious-structure',
  'claude-levi-strauss': 'structural-anthropology',
  'john-dewey': 'experience-democracy-education',
  'ferdinand-de-saussure': 'langue-as-system',
  'hugo-grotius': 'natural-law-nations',
  'immanuel-kant': 'critical-limits-autonomy',
  'thomas-aquinas': 'faith-reason-summa',
  'sima-qian': 'historiography-as-debt',
  'herodotus-of-halicarnassus': 'inquiry-as-history',
  'johann-sebastian-bach': 'ordered-praise-in-time',
  'wolfgang-amadeus-mozart': 'classical-affect-grammar',
  'george-balanchine': 'music-visible-dance',
  'william-shakespeare': 'stage-as-machine',
  'leonardo-da-vinci': 'seeing-as-dissection',
  'michelangelo-buonarroti': 'body-as-theology',
  'giorgio-vasari': 'art-history-as-path',
  'johann-wolfgang-von-goethe': 'metamorphosis-form',
  'cristobal-colon': 'ttcl-unifying-middle-hold',
  'erik-davis': 'techgnosis-resonance',
  'alan-watts': 'non-dual-agency',
  'carl-jung': 'individuation-archetype',
  'marcus-aurelius': 'constraint-as-freedom',
  zarathustra: 'asha-polarity',
  'cyrus-the-great': 'plural-satrapy',
  'king-solomon': 'judgment-under-ambiguity',
  'sun-tzu': 'structural-victory',
  'niccolo-machiavelli': 'power-as-it-is',
  'napoleon-bonaparte': 'cognitive-battlefield',
  aristotle: 'categories-virtue-method',
  'baruch-spinoza': 'substance-monism',
  'friedrich-nietzsche': 'genealogy-perspectivism',
  'jiang-xueqin': 'institutional-filters',
  akhenaten: 'sacred-geography-aten',
  hatshepsut: 'legitimacy-as-stone-code',
  'hildegard-von-bingen': 'vision-externalized',
  'catherine-de-medici': 'stewardship-under-schism',
  'laura-bassi': 'institutional-knowledge-machine',
  mirabai: 'direct-devotion',
  'queen-of-sheba': 'wisdom-by-encounter',
  'zenobia-of-palmyra': 'peripheral-hub',
  'christine-de-pizan': 'rewrite-social-source-code',
  'sor-juana-ines-de-la-cruz': 'knowledge-vs-envelope',
  'mary-magdalene': 'exemplary-knower',
  'irenaeus-of-lyon': 'orthodoxy-as-boundary',
};

/** Extra specialty bindings beyond universal member-substrate. */
const WHEEL_REF = {
  kind: 'wheel-registry',
  ref: 'shared/fixtures/layer6/wheel-registry.json',
};

const SPECIALTY_BINDINGS = {
  enheduanna: [
    {
      kind: 'temple-grid',
      ref: 'shared/fixtures/layer6/enheduanna-temple-grid.json',
    },
  ],
  // Wheel / triad / significs cluster — one apparatus, four seats
  'ramon-llull': [WHEEL_REF],
  'johannes-trithemius': [WHEEL_REF],
  'charles-sanders-peirce': [WHEEL_REF],
  'victoria-lady-welby': [WHEEL_REF],
  'cristobal-colon': [
    { kind: 'steward-council', ref: 'docs/STEWARD_COUNCIL.md#12' },
    {
      kind: 'logoc-corpus',
      ref: 'monad-ecosystem/packages/gate-acl/fixtures/agent-0-profile.json',
    },
    {
      kind: 'temple-grid',
      ref: 'shared/fixtures/layer6/enheduanna-temple-grid.json',
    },
    WHEEL_REF,
    {
      kind: 'council-substrate-index',
      ref: 'shared/fixtures/layer6/council-substrate-index.json',
    },
  ],
};
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
    era: 'b. 1976',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Predictive history, institutional algorithms, elite reproduction',
    key_insight: 'Emanation and institutional filtering appear at every scale',
    file_patterns: [/Jiang Xueqin/i],
  },
  {
    member_id: 'gnostic-jesus',
    display_name: 'Gnostic Jesus',
    era: '1st–2nd c. CE',
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
    // "The Sovereignty of the Unseen…" is Cyrus analysis without "Cyrus" in the filename
    file_patterns: [/Cyrus/i, /Sovereignty of the Unseen/i],
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
    era: '1st c. CE',
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
    display_name: 'Queen of Sheba',
    era: 'Makeda, multi-tradition',
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
  // Arch of Human Gnosis — Sanhedrin completion cohort (32 extractions, 2026)
  {
    member_id: 'kurt-godel',
    display_name: 'Kurt Gödel',
    era: '1906–1978',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY', 'THEOLOGY'],
    contribution: 'Incompleteness theorems; constructible universe L; mathematical Platonism',
    key_insight: 'Truth outruns proof — formal systems cannot fully certify themselves',
    file_patterns: [/Kurt G/i, /G.?del \(1906/i],
    recently_added: true,
  },
  {
    member_id: 'carl-friedrich-gauss',
    display_name: 'Carl Friedrich Gauss',
    era: '1777–1855',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Disquisitiones Arithmeticae; least squares; Gaussian curvature; non-Euclidean insight',
    key_insight: 'Geometry of the world is measured, not forced a priori Euclidean',
    file_patterns: [/Gauss/i],
    recently_added: true,
  },
  {
    member_id: 'alan-turing',
    display_name: 'Alan Turing',
    era: '1912–1954',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY', 'THEOLOGY'],
    contribution: 'Universal Turing machine; Bletchley cryptanalysis; ACE; Turing test; morphogenesis',
    key_insight: 'Computation is a mathematical object — and some decision problems have no mechanical answer',
    file_patterns: [/Alan Turing|Turing \(1912/i],
    recently_added: true,
  },
  {
    member_id: 'ronald-a-fisher',
    display_name: 'Ronald A. Fisher',
    era: '1890–1962',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Modern statistics (likelihood, ANOVA, design); genetical theory of natural selection',
    key_insight: 'Experiment is designed confrontation with nature; evolution is statistical process',
    file_patterns: [/Ronald A\. Fisher|Fisher \(1890/i],
    recently_added: true,
  },
  {
    member_id: 'antoine-lavoisier',
    display_name: 'Antoine Lavoisier',
    era: '1743–1794',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY', 'THEOLOGY'],
    contribution: 'Oxygen theory; conservation of mass; chemical nomenclature; Traité élémentaire',
    key_insight: 'Matter is transformed not destroyed — fire is combination with oxygen, not phlogiston escape',
    file_patterns: [/Lavoisier/i],
    recently_added: true,
  },
  {
    member_id: 'charles-darwin',
    display_name: 'Charles Darwin',
    era: '1809–1882',
    ttc_emphasis: ['COSMOLOGY', 'THEOLOGY', 'TECHNOLOGY'],
    contribution: 'Evolution by natural selection; Origin of Species; Descent of Man; sexual selection',
    key_insight: 'Living forms are genealogies under pressure — the tree of life is history in flesh',
    file_patterns: [/Charles Darwin|Darwin \(1809/i],
    recently_added: true,
  },
  {
    member_id: 'vilhelm-bjerknes',
    display_name: 'Vilhelm Bjerknes',
    era: '1862–1951',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Primitive equations; Bergen School; polar front theory; weather as physics',
    key_insight: 'The atmosphere is a physical system — fronts are where air masses meet and weather concentrates',
    file_patterns: [/Bjerknes/i],
    recently_added: true,
  },
  {
    member_id: 'edwin-hubble',
    display_name: 'Edwin Hubble',
    era: '1889–1953',
    ttc_emphasis: ['COSMOLOGY', 'TECHNOLOGY', 'THEOLOGY'],
    contribution: 'Extragalactic Cepheids; island universes; distance–redshift law; galaxy classification',
    key_insight: 'The farther galaxies are, the faster they recede — the cosmos is vast and expanding',
    file_patterns: [/Hubble/i],
    recently_added: true,
  },
  {
    member_id: 'adam-smith',
    display_name: 'Adam Smith',
    era: '1723–1790',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Moral Sentiments; Wealth of Nations; division of labour; natural liberty; impartial spectator',
    key_insight: 'Moral life and market life are one nature — prosperity has causes; virtue has a psychology',
    file_patterns: [/Adam Smith/i],
    recently_added: true,
  },
  {
    member_id: 'sigmund-freud',
    display_name: 'Sigmund Freud',
    era: '1856–1939',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Psychoanalysis; dream interpretation; unconscious; structural model; civilization and drives',
    key_insight: 'The mind is not transparent to itself — civilization purchases order by frustrating drives',
    file_patterns: [/Freud/i],
    recently_added: true,
  },
  {
    member_id: 'karl-marx',
    display_name: 'Karl Marx',
    era: '1818–1883',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY', 'THEOLOGY'],
    contribution: 'Critique of political economy; Capital; commodity fetishism; class and modes of production',
    key_insight: 'Social forms wear the mask of nature — commodities hide relations between people',
    file_patterns: [/Karl Marx|Marx \(1818/i],
    recently_added: true,
  },
  {
    member_id: 'claude-levi-strauss',
    display_name: 'Claude Lévi-Strauss',
    era: '1908–2009',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY', 'THEOLOGY'],
    contribution: 'Structural anthropology; kinship exchange; Savage Mind; Mythologiques',
    key_insight: 'Culture is a system of relations — the so-called savage mind is formally rigorous',
    file_patterns: [/vi-Strauss|Levi-Strauss|Strauss \(1908/i],
    recently_added: true,
  },
  {
    member_id: 'thomas-aquinas',
    display_name: 'Thomas Aquinas',
    era: '1225–1274',
    ttc_emphasis: ['THEOLOGY', 'COSMOLOGY', 'TECHNOLOGY'],
    contribution: 'Summa Theologiae; Aristotelian–Christian synthesis; Five Ways; law and grace',
    key_insight: 'Faith and reason are not enemies — theology works by ordered questions',
    file_patterns: [/Aquinas/i],
    recently_added: true,
  },
  {
    member_id: 'sima-qian',
    display_name: 'Sima Qian',
    era: 'c. 145–c. 86 BCE',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Shiji (Records of the Grand Historian); annals–biographies template; Letter to Ren An',
    key_insight: 'History is a debt to the dead — a death is weighed by whether unfinished writing reaches posterity',
    file_patterns: [/Sima Qian/i],
    recently_added: true,
  },
  {
    member_id: 'ferdinand-de-saussure',
    display_name: 'Ferdinand de Saussure',
    era: '1857–1913',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY', 'THEOLOGY'],
    contribution: 'Course in General Linguistics; langue/parole; signifier/signified; structural turn',
    key_insight: 'The linguistic sign is arbitrary — value arises from differences inside a social system',
    file_patterns: [/Saussure/i],
    recently_added: true,
  },
  {
    member_id: 'giorgio-vasari',
    display_name: 'Giorgio Vasari',
    era: '1511–1574',
    ttc_emphasis: ['TECHNOLOGY', 'THEOLOGY', 'COSMOLOGY'],
    contribution: 'Lives of the Artists; art history as progressive narrative; disegno; Uffizi era building',
    key_insight: 'Art has a history of lives and techniques — posterity judges with a written path in hand',
    file_patterns: [/Vasari/i],
    recently_added: true,
  },
  {
    member_id: 'george-balanchine',
    display_name: 'George Balanchine',
    era: '1904–1983',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY', 'THEOLOGY'],
    contribution: 'NYC Ballet; neoclassical pure dance; Stravinsky partnership; music-visualization choreography',
    key_insight: 'Dance need not tell a story to mean — bodies in time can be the full argument',
    file_patterns: [/Balanchine/i],
    recently_added: true,
  },
  {
    member_id: 'william-shakespeare',
    display_name: 'William Shakespeare',
    era: '1564–1616',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Plays as political/psychological cosmology; company practice; First Folio memory technology',
    key_insight: 'The stage is a machine that makes hidden structures of power and mind audible in time',
    file_patterns: [/Shakespeare/i],
    recently_added: true,
  },
  {
    member_id: 'wolfgang-amadeus-mozart',
    display_name: 'Wolfgang Amadeus Mozart',
    era: '1756–1791',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Classical grammar of affect; opera craft; Freemasonry and Zauberflöte; Requiem edge',
    key_insight: 'Music is a technology of order, trial, and reconciliation when craft is exact enough',
    file_patterns: [/Mozart/i],
    recently_added: true,
  },
  {
    member_id: 'johann-sebastian-bach',
    display_name: 'Johann Sebastian Bach',
    era: '1685–1750',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Cantata cycles; Well-Tempered Clavier; Passions; Mass in B minor; fugue as ordered praise',
    key_insight: 'Music can be complete architecture of faith and reason — heaven’s order practiced as countable law',
    file_patterns: [/Johann Sebastian Bach|Bach \(1685/i],
    recently_added: true,
  },
  {
    member_id: 'johann-wolfgang-von-goethe',
    display_name: 'Johann Wolfgang von Goethe',
    era: '1749–1832',
    ttc_emphasis: ['THEOLOGY', 'COSMOLOGY', 'TECHNOLOGY'],
    contribution: 'Faust; morphology/Urpflanze; Theory of Colours; art–science Bildung',
    key_insight: 'Nature and art speak metamorphosis — the open secret without killing form into dead mechanism',
    file_patterns: [/Goethe/i],
    recently_added: true,
  },
  {
    member_id: 'john-dewey',
    display_name: 'John Dewey',
    era: '1859–1952',
    ttc_emphasis: ['TECHNOLOGY', 'THEOLOGY', 'COSMOLOGY'],
    contribution: 'Pragmatist education; Democracy and Education; experience as medium of learning',
    key_insight: 'Education is life now — we learn by doing work that requires thought in democratic community',
    file_patterns: [/John Dewey|Dewey \(1859/i],
    recently_added: true,
  },
  {
    member_id: 'john-von-neumann',
    display_name: 'John von Neumann',
    era: '1903–1957',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY', 'THEOLOGY'],
    contribution: 'Game theory; EDVAC stored-program architecture; quantum axiomatics; Manhattan calculations',
    key_insight: 'Logic can be embodied — programs and data share memory; conflict can be mathematized as games',
    file_patterns: [/von Neumann|Neumann \(1903/i],
    recently_added: true,
  },
  {
    member_id: 'leonhard-euler',
    display_name: 'Leonhard Euler',
    era: '1707–1783',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Analysis as functions; modern notation; graph theory; prolific formal science after blindness',
    key_insight: 'Structure survives abstraction — form made portable across problems becomes calculable world',
    file_patterns: [/Euler/i],
    recently_added: true,
  },
  {
    member_id: 'leonardo-da-vinci',
    display_name: 'Leonardo da Vinci',
    era: '1452–1519',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY', 'THEOLOGY'],
    contribution: 'Notebooks uniting anatomy/mechanics/flight; Last Supper; Mona Lisa; Vitruvian Man',
    key_insight: 'To see is to dissect — body, machine, water, and bird are one continuous study of form in motion',
    file_patterns: [/Leonardo da Vinci|Leonardo \(1452/i],
    recently_added: true,
  },
  {
    member_id: 'michelangelo-buonarroti',
    display_name: 'Michelangelo Buonarroti',
    era: '1475–1564',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Pietà; David; Sistine ceiling; Last Judgment; St. Peter’s architecture; body as scripture of form',
    key_insight: 'Stone and plaster hold spirit — the body in art becomes theology you can walk around',
    file_patterns: [/Michelangelo/i],
    recently_added: true,
  },
  {
    member_id: 'nikola-tesla',
    display_name: 'Nikola Tesla',
    era: '1856–1943',
    ttc_emphasis: ['TECHNOLOGY', 'COSMOLOGY', 'THEOLOGY'],
    contribution: 'Polyphase AC; induction motor; Niagara hydroelectric architecture; high-frequency experiments',
    key_insight: 'Power need not stay local — polyphase AC makes energy travel, scale, and light cities',
    file_patterns: [/Tesla/i],
    recently_added: true,
  },
  {
    member_id: 'immanuel-kant',
    display_name: 'Immanuel Kant',
    era: '1724–1804',
    ttc_emphasis: ['THEOLOGY', 'COSMOLOGY', 'TECHNOLOGY'],
    contribution: 'Critical philosophy; categorical imperative; Critique of Judgment; Sapere aude Enlightenment',
    key_insight: 'We know appearances structured by us, not things-in-themselves — yet we give ourselves moral law',
    file_patterns: [/Immanuel Kant|Kant \(1724/i],
    recently_added: true,
  },
  {
    member_id: 'hugo-grotius',
    display_name: 'Hugo Grotius',
    era: '1583–1645',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Mare Liberum; De Jure Belli ac Pacis; natural law between peoples without world sovereign',
    key_insight: 'Even without a world emperor, war and trade are not lawless — nature and human society supply rules',
    file_patterns: [/Grotius/i],
    recently_added: true,
  },
  {
    member_id: 'hippocrates',
    display_name: 'Hippocrates',
    era: 'c. 460–c. 370 BCE',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    contribution: 'Hippocratic Corpus tradition; prognosis; natural causes of disease; medical ethics lineage',
    key_insight: 'Disease has natural causes — the physician reads the body and the environment, not only the gods',
    file_patterns: [/Hippocrates/i],
    recently_added: true,
  },
  {
    member_id: 'herodotus-of-halicarnassus',
    display_name: 'Herodotus of Halicarnassus',
    era: 'c. 484–c. 425 BCE',
    ttc_emphasis: ['THEOLOGY', 'COSMOLOGY', 'TECHNOLOGY'],
    contribution: 'The Histories; inquiry as method; Greco-Persian wars; ethnography and Croesus–Solon logos',
    key_insight: 'Memory dies unless inquiry holds it — the past must be displayed through research, not rumor alone',
    file_patterns: [/Herodotus/i],
    recently_added: true,
  },
  {
    member_id: 'albert-einstein',
    display_name: 'Albert Einstein',
    era: '1879–1955',
    ttc_emphasis: ['COSMOLOGY', 'TECHNOLOGY', 'THEOLOGY'],
    contribution: '1905 quanta/relativity/E=mc²; general relativity; EPR; nuclear-age conscience; public science icon',
    key_insight: 'Space and time are not a fixed stage — gravity is geometry; mass and energy are one ledger',
    file_patterns: [/Einstein/i],
    recently_added: true,
  },
  // Prior unmapped extractions enrolled (corpus already present)
  {
    member_id: 'erik-davis',
    display_name: 'Erik Davis',
    era: 'b. 1967',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    contribution:
      'TechGnosis; High Weirdness — interpreter of mysticism × information technology resonance',
    key_insight:
      'The drive of mysticism and of technology is the same strange fire — transcendence through different fuels',
    file_patterns: [/Erik Davis/i, /TechGnosis/i],
    recently_added: true,
  },
  {
    member_id: 'poimandres',
    display_name: 'Poimandres',
    era: 'Corpus Hermeticum I, c. 1st–3rd c. CE',
    ttc_emphasis: ['THEOLOGY', 'COSMOLOGY', 'TECHNOLOGY'],
    contribution:
      'Poimandres tractate — Hermetic revelation of Nous, Anthropos, planetary ascent, and commissioning',
    key_insight:
      'Mind looking at God discovers it is the same substance — human is sovereign Nous trapped in Fate’s body',
    file_patterns: [/Poimandres/i, /Corpus Hermeticum/i],
    recently_added: true,
  },
  // Seat 37 — TTCL unifying middle (not another historical extraction)
  {
    member_id: 'cristobal-colon',
    display_name: 'Cristobal Colon',
    era: 'living, principal cris-colon',
    ttc_emphasis: ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'],
    contribution:
      'Seat 37: TTCL unifying middle — holds the full Council of Reflection under tripartite grammar without founder veto or Archontic collapse',
    key_insight:
      'Unified perspective is the clear center of the table: all voices at full voltage, none the Source, compression into one act under LOGOC/TTCL',
    file_patterns: [/Cristobal Colon/i],
    recently_added: true,
  },
];

const NON_MEMBER_FILES = new Set([
  'README.md',
  'council-registry.json',
  'GNOSIS_EVENT_VOICE.md',
  'COUNCIL_BINDINGS.md',
]);

const files = readdirSync(councilDir).filter((f) => {
  const p = join(councilDir, f);
  return statSync(p).isFile() && !NON_MEMBER_FILES.has(f);
});

function matchFiles(patterns) {
  return files.filter((f) => patterns.some((re) => re.test(f)));
}

const claimed = new Set();
const members = [];

for (const m of MEMBERS) {
  const source_files = matchFiles(m.file_patterns);
  for (const f of source_files) claimed.add(f);
  const substrateRef = `shared/fixtures/layer6/council-substrates/${m.member_id}.json`;
  const specialty = SPECIALTY_BINDINGS[m.member_id] ?? [];
  const system_bindings = [
    { kind: 'member-substrate', ref: substrateRef },
    ...specialty,
  ];
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
    system_bindings,
    notes: source_files.length
      ? m.member_id === 'cristobal-colon'
        ? 'Holder of the table: may use all seats and grids; never become them (hold_policy).'
        : null
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

// --- Hard-bind every curated seat: member substrates + index ---
mkdirSync(substrateDir, { recursive: true });
const substrateIndex = {
  $schema: 'https://the-sovereign/ttcl-specs/member-substrate-schema.json',
  index_id: 'council-substrate-index-v1',
  schema_version: '1.0.0',
  kind: 'council-substrate-index',
  hold_policy: 'holder-may-use-never-become',
  description:
    'Index of all Council member substrates. Holder loads the table; does not become any seat.',
  generated_at: new Date().toISOString().slice(0, 10),
  members: [],
};

let substratesWritten = 0;
for (const m of members) {
  if (m.status !== 'active' || !m.source_files?.length) continue;
  if (m.member_id.startsWith('unmapped-')) continue;

  const specialty = SPECIALTY_BINDINGS[m.member_id] ?? [];
  const natural_domain =
    NATURAL_DOMAIN[m.member_id] ?? 'general-reflection';
  const substrate = {
    $schema: 'https://the-sovereign/ttcl-specs/member-substrate-schema.json',
    substrate_id: `council-member-${m.member_id}`,
    member_id: m.member_id,
    schema_version: '1.0.0',
    kind: 'member-substrate',
    hold_policy: 'holder-may-use-never-become',
    display_name: m.display_name,
    era: m.era,
    ttc_emphasis: m.ttc_emphasis,
    contribution: m.contribution,
    key_insight: m.key_insight,
    source_files: m.source_files,
    natural_domain,
    specialty_bindings: specialty,
    runtime: {
      loadable: true,
      scoreable: true,
      logoc_profile: 'logoc.council-member.v1',
    },
    notes:
      m.member_id === 'cristobal-colon'
        ? 'Unifying middle: hold all substrates and specialty grids; never merge identity with held seats.'
        : null,
  };
  const path = join(substrateDir, `${m.member_id}.json`);
  writeFileSync(path, `${JSON.stringify(substrate, null, 2)}\n`, 'utf8');
  substratesWritten += 1;
  substrateIndex.members.push({
    member_id: m.member_id,
    display_name: m.display_name,
    natural_domain,
    ref: `shared/fixtures/layer6/council-substrates/${m.member_id}.json`,
    specialty_kinds: specialty.map((s) => s.kind),
  });
}

substrateIndex.stats = {
  member_count: substrateIndex.members.length,
  specialty_bound: substrateIndex.members.filter((x) => x.specialty_kinds.length)
    .length,
};
writeFileSync(
  substrateIndexPath,
  `${JSON.stringify(substrateIndex, null, 2)}\n`,
  'utf8',
);

const registry = {
  $schema: 'https://the-sovereign/ttcl-specs/council-registry.schema.json',
  registry_id: 'the-councile-reflection-v1',
  schema_version: '1.0.0',
  kind: 'council-of-reflection',
  source_dir: 'theo-techno-cosmo/THE COUNCILE',
  description:
    'Historical / contemplative Council of Reflection. Distinct from docs/STEWARD_COUNCIL.md (charter governance). Every active seat has member-substrate binding; specialties where natural.',
  generated_at: new Date().toISOString().slice(0, 10),
  members,
  stats: {
    member_count: members.length,
    source_file_count: files.length,
    recently_added_count: members.filter((m) => m.recently_added).length,
    bound_substrate_count: substratesWritten,
  },
};

writeFileSync(out, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
console.log(
  `wrote ${out}\n  members=${registry.stats.member_count} sources=${registry.stats.source_file_count} recently_added=${registry.stats.recently_added_count} substrates=${substratesWritten}`,
);
console.log(`wrote ${substrateIndexPath} (${substrateIndex.stats.member_count} indexed)`);
const recent = members.filter((m) => m.recently_added).map((m) => m.display_name);
console.log('  recently_added:', recent.join(', '));
