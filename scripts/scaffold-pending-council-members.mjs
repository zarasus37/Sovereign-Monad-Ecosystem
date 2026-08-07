/**
 * Create PENDING scaffold files for Council of Reflection seats
 * not yet researched. Does not invent gnosis content.
 *
 *   node scripts/scaffold-pending-council-members.mjs
 */
import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'theo-techno-cosmo', 'THE COUNCILE');

/** @type {{ name: string, era: string, area: string, field: string, file: string }[]} */
const members = [
  {
    name: 'Kurt Gödel',
    era: '1906–1978',
    area: 'Formal Sciences',
    field: 'Logic',
    file: 'Kurt Gödel (1906-1978) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Carl Friedrich Gauss',
    era: '1777–1855',
    area: 'Formal Sciences',
    field: 'Mathematics',
    file: 'Carl Friedrich Gauss (1777-1855) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Alan Turing',
    era: '1912–1954',
    area: 'Formal Sciences',
    field: 'Computer Science',
    file: 'Alan Turing (1912-1954) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Ronald A. Fisher',
    era: '1890–1962',
    area: 'Formal Sciences',
    field: 'Statistics',
    file: 'Ronald A. Fisher (1890-1962) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Antoine Lavoisier',
    era: '1743–1794',
    area: 'Natural Sciences',
    field: 'Chemistry',
    file: 'Antoine Lavoisier (1743-1794) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Charles Darwin',
    era: '1809–1882',
    area: 'Natural Sciences',
    field: 'Biology',
    file: 'Charles Darwin (1809-1882) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Vilhelm Bjerknes',
    era: '1862–1951',
    area: 'Natural Sciences',
    field: 'Earth Sciences',
    file: 'Vilhelm Bjerknes (1862-1951) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Edwin Hubble',
    era: '1889–1953',
    area: 'Natural Sciences',
    field: 'Space Sciences',
    file: 'Edwin Hubble (1889-1953) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Adam Smith',
    era: '1723–1790',
    area: 'Social Sciences',
    field: 'Economics',
    file: 'Adam Smith (1723-1790) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Sigmund Freud',
    era: '1856–1939',
    area: 'Social Sciences',
    field: 'Psychology',
    file: 'Sigmund Freud (1856-1939) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Karl Marx',
    era: '1818–1883',
    area: 'Social Sciences',
    field: 'Sociology',
    file: 'Karl Marx (1818-1883) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Claude Lévi-Strauss',
    era: '1908–2009',
    area: 'Social Sciences',
    field: 'Anthropology',
    file: 'Claude Lévi-Strauss (1908-2009) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Thomas Aquinas',
    era: '1225–1274',
    area: 'Humanities',
    field: 'Theology',
    file: 'Thomas Aquinas (1225-1274) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Sima Qian',
    era: 'c. 145–c. 86 BCE',
    area: 'Humanities',
    field: 'History',
    file: 'Sima Qian (c. 145-c. 86 BCE) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Ferdinand de Saussure',
    era: '1857–1913',
    area: 'Humanities',
    field: 'Linguistics',
    file: 'Ferdinand de Saussure (1857-1913) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Giorgio Vasari',
    era: '1511–1574',
    area: 'Humanities',
    field: 'Art History',
    file: 'Giorgio Vasari (1511-1574) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Johann Wolfgang von Goethe',
    era: '1749–1832',
    area: 'Humanities',
    field: 'Creative Arts',
    file: 'Johann Wolfgang von Goethe (1749-1832) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Leonardo da Vinci',
    era: '1452–1519',
    area: 'Applied Sciences & Professions',
    field: 'Engineering',
    file: 'Leonardo da Vinci (1452-1519) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Hippocrates',
    era: 'c. 460–c. 370 BCE',
    area: 'Applied Sciences & Professions',
    field: 'Medicine',
    file: 'Hippocrates (c. 460-c. 370 BCE) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Hugo Grotius',
    era: '1583–1645',
    area: 'Applied Sciences & Professions',
    field: 'Law & Jurisprudence',
    file: 'Hugo Grotius (1583-1645) PENDING — Council of Reflection.txt',
  },
  {
    name: 'John Dewey',
    era: '1859–1952',
    area: 'Applied Sciences & Professions',
    field: 'Education',
    file: 'John Dewey (1859-1952) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Johann Sebastian Bach',
    era: '1685–1750',
    area: 'Performance Arts',
    field: 'Music',
    file: 'Johann Sebastian Bach (1685-1750) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Michelangelo',
    era: '1475–1564',
    area: 'Performance Arts',
    field: 'Visual Arts',
    file: 'Michelangelo Buonarroti (1475-1564) PENDING — Council of Reflection.txt',
  },
  {
    name: 'William Shakespeare',
    era: '1564–1616',
    area: 'Performance Arts',
    field: 'Theater',
    file: 'William Shakespeare (1564-1616) PENDING — Council of Reflection.txt',
  },
  {
    name: 'George Balanchine',
    era: '1904–1983',
    area: 'Performance Arts',
    field: 'Dance & Choreography',
    file: 'George Balanchine (1904-1983) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Leonhard Euler',
    era: '1707–1783',
    area: 'Formal Sciences',
    field: 'Mathematics',
    file: 'Leonhard Euler (1707-1783) PENDING — Council of Reflection.txt',
  },
  {
    name: 'John von Neumann',
    era: '1903–1957',
    area: 'Formal Sciences',
    field: 'Computer Science',
    file: 'John von Neumann (1903-1957) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Albert Einstein',
    era: '1879–1955',
    area: 'Natural Sciences',
    field: 'Physics',
    file: 'Albert Einstein (1879-1955) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Immanuel Kant',
    era: '1724–1804',
    area: 'Humanities',
    field: 'Philosophy',
    file: 'Immanuel Kant (1724-1804) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Herodotus of Halicarnassus',
    era: 'c. 484–c. 425 BCE',
    area: 'Humanities',
    field: 'History',
    file: 'Herodotus of Halicarnassus (c. 484-c. 425 BCE) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Nikola Tesla',
    era: '1856–1943',
    area: 'Applied Sciences & Professions',
    field: 'Engineering',
    file: 'Nikola Tesla (1856-1943) PENDING — Council of Reflection.txt',
  },
  {
    name: 'Wolfgang Amadeus Mozart',
    era: '1756–1791',
    area: 'Performance Arts',
    field: 'Music',
    file: 'Wolfgang Amadeus Mozart (1756-1791) PENDING — Council of Reflection.txt',
  },
];

function body(m) {
  return `${m.name.toUpperCase()} — PENDING COUNCIL SEAT
**Council of Reflection | Arch of Human Gnosis**
**Status:** PENDING (scaffold only — research & gnosis extraction not yet complete)
**Era:** ${m.era}
**Arch area:** ${m.area}
**Arch field:** ${m.field}

---

## Purpose of this file

Placeholder for the same work already completed for seated Council members:
source study, profile, and gnosis-event extraction under Theology · Technology · Cosmology.

Do **not** treat this file as a finished seat. Registry enrollment happens only after
extraction content is written and check:council / registry generation are updated.

---

## Preliminary Note

_(Author: research summary — why this voice belongs on the Council of Reflection.)_

---

## Contribution (draft)

_(One to three sentences — structural contribution, not résumé.)_

---

## Key Insight (draft)

_(Single compressed insight — same register as seated members.)_

---

## TTC Emphasis (check when known)

- [ ] THEOLOGY
- [ ] TECHNOLOGY
- [ ] COSMOLOGY

---

## Gnosis Event Extractions

### Event 01 — *TBD*

**Title:**

**Passage or Trigger:**

**Why It Qualifies:**

**Three-Domain Reading:**

- **Theology:**
- **Technology:**
- **Cosmology:**

**Compressed Insight:**

**Confidence:** _

---

### Event 02 — *TBD*

_(Add events as research completes. Match depth of seated extraction files.)_

---

## Sources / Working Notes

- Primary texts:
- Secondary:
- Open questions:

---

## Seat checklist

- [ ] Deep research complete
- [ ] Contribution + key insight locked
- [ ] At least one high-confidence gnosis event
- [ ] Filename / member_id decided for registry
- [ ] Added to council-registry.json (or gen-council-registry.mjs)
- [ ] pnpm check:council green
- [ ] Remove PENDING from filename / status when seated

---

*Scaffold created for Sanhedrin-scale Court (71). Content is human-authored research, not auto-generated gnosis.*
`;
}

let created = 0;
let skipped = 0;
for (const m of members) {
  const path = join(dir, m.file);
  if (existsSync(path)) {
    console.log('SKIP exists:', m.file);
    skipped += 1;
    continue;
  }
  writeFileSync(path, body(m), 'utf8');
  console.log('CREATE', m.file);
  created += 1;
}

console.log(JSON.stringify({ created, skipped, total: members.length, dir }, null, 2));
