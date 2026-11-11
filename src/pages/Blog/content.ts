// Written content for the public blog pages. Facts about bodies and leaders
// were checked in November 2026 against nse.org.ng and coren.gov.ng.

/** Photos and logos live in the public "blog" storage bucket under assets/ */
export const ASSET_BASE = 'https://nzxvupidbjcfinoztmrd.supabase.co/storage/v1/object/public/blog/assets/';
export const asset = (name: string) => ASSET_BASE + name;

export const IMAGES = {
  hero: asset('hero-faculty.jpg'),
  gate: asset('uniabuja-gate.jpg'),
  senate: asset('uniabuja-senate.jpg'),
  library: asset('uniabuja-library.jpg'),
  lab: asset('lab.jpg'),
  student: asset('student.jpg'),
  roadEngineers: asset('road-engineers.jpg'),
  construction: asset('abuja-construction.jpg'),
  tower: asset('abuja-tower.jpg'),
  port: asset('lekki-port.jpg'),
  solar: asset('solar.jpg'),
};

export const LOGOS: Record<string, string> = {
  NSE: asset('logo-nse.png'),
  'NSE Abuja': asset('logo-nse.png'),
  COREN: asset('logo-coren.jpg'),
  NSChE: asset('logo-nsche.png'),
  NIMechE: asset('logo-nimeche.jpg'),
};

/** A fitting photo for each category, used when an article or headline has no picture of its own */
export const CATEGORY_IMAGES: Record<string, string> = {
  nuesa: asset('student.jpg'),
  nse: asset('road-engineers.jpg'),
  coren: asset('abuja-tower.jpg'),
  uniabuja: asset('hero-faculty.jpg'),
  engineering: asset('civil.jpg'),
  students: asset('student.jpg'),
  events: asset('uniabuja-senate.jpg'),
  careers: asset('abuja-construction.jpg'),
  guides: asset('uniabuja-library.jpg'),
  opinion: asset('lekki-port.jpg'),
};
export const categoryImage = (c?: string | null) => (c && CATEGORY_IMAGES[c]) || asset('civil.jpg');

/** Photos come from Wikimedia Commons. CC BY-SA asks us to credit the photographer. */
export const PHOTO_CREDITS: { what: string; by: string; licence: string }[] = [
  { what: 'Faculty of Engineering, University of Abuja', by: 'Habila Sani Mazawaje', licence: 'CC BY-SA 4.0' },
  { what: 'University of Abuja main gate', by: 'Iamjoezy', licence: 'CC BY-SA 4.0' },
  { what: 'University of Abuja senate building and library', by: 'Habila Sani Mazawaje', licence: 'CC BY-SA 4.0' },
  { what: 'Second Niger Bridge, Dangote refinery column, Lekki Port', by: 'FrankvEck', licence: 'CC BY-SA 4.0' },
  { what: 'Kainji Dam', by: 'Arcgwandu', licence: 'CC BY-SA 4.0' },
  { what: 'Innoson vehicle plant, Nnewi', by: 'MediaMOF', licence: 'CC BY-SA 4.0' },
  { what: 'Tractor making ridges', by: 'Sasu photography', licence: 'CC BY-SA 4.0' },
  { what: 'Runway approach, Nnamdi Azikiwe Airport', by: 'Sm105', licence: 'CC BY-SA 4.0' },
  { what: 'Train in Abeokuta', by: 'Adefolahan Olamilekan', licence: 'CC BY-SA 4.0' },
  { what: 'Offshore engineering in Nigeria', by: 'Windfallengprojectsltd', licence: 'CC BY-SA 4.0' },
  { what: 'Computer lab, Nile University', by: 'Chris Ikpemi', licence: 'CC BY-SA 4.0' },
  { what: 'Ajaokuta steel plant', by: 'Ilya Volkov', licence: 'Public domain' },
  { what: 'Tin mine, Jos', by: 'Unknown', licence: 'Public domain' },
  { what: 'Chemistry lab, Augustine University', by: 'Addjimedu', licence: 'CC0' },
  { what: 'Road construction engineers', by: 'Tunesh247', licence: 'CC BY-SA 4.0' },
  { what: 'Building site in Abuja', by: 'Anasskoko', licence: 'CC BY-SA 4.0' },
  { what: 'Abuja tower under construction', by: 'Igboanude', licence: 'CC BY-SA 4.0' },
  { what: 'Engineering student at work', by: 'Oluphisayo', licence: 'CC BY-SA 4.0' },
  { what: 'Solar panels, Irawo', by: 'NigerianScribe', licence: 'CC0' },
];

export const CATEGORIES: Record<string, { label: string; color: string }> = {
  nuesa: { label: 'NUESA', color: 'bg-emerald-600' },
  nse: { label: 'NSE', color: 'bg-blue-600' },
  coren: { label: 'COREN', color: 'bg-indigo-600' },
  uniabuja: { label: 'UniAbuja', color: 'bg-teal-600' },
  engineering: { label: 'Engineering', color: 'bg-amber-600' },
  students: { label: 'Students', color: 'bg-rose-600' },
  events: { label: 'Events', color: 'bg-purple-600' },
  careers: { label: 'Careers', color: 'bg-cyan-700' },
  guides: { label: 'Guides', color: 'bg-lime-700' },
  opinion: { label: 'Opinion', color: 'bg-orange-600' },
};
export const categoryLabel = (c?: string | null) => (c && CATEGORIES[c]?.label) || 'Engineering';
export const categoryColor = (c?: string | null) => (c && CATEGORIES[c]?.color) || 'bg-slate-600';

export interface Discipline {
  slug: string;
  name: string;
  atUniAbuja: boolean;
  /** Real photo of this kind of work in Nigeria (see PHOTO_CREDITS) */
  image: string;
  /** Logo of the professional body for this discipline, when one could be found */
  logo?: string;
  summary: string;
  work: string[];
  careers: string[];
  bodies: string[];
}

// The seven departments of the Faculty of Engineering, University of Abuja,
// come first; then other disciplines taught across Nigeria.
export const DISCIPLINES: Discipline[] = [
  {
    slug: 'civil', name: 'Civil Engineering', atUniAbuja: true, image: asset('civil.jpg'),
    summary: 'Plans, designs and builds the roads, bridges, buildings, dams, water supply and drainage that every community depends on.',
    work: ['Structural design of buildings and bridges', 'Highway and transportation engineering', 'Water resources, hydrology and sanitation', 'Geotechnical and foundation engineering', 'Construction and project management'],
    careers: ['Construction firms and contractors', 'Consulting engineering firms', 'Federal and state ministries of works', 'Water boards and river basin authorities', 'Real estate and infrastructure developers'],
    bodies: ['Nigerian Institution of Civil Engineers (NICE), a division of NSE', 'COREN registration'],
  },
  {
    slug: 'electrical', name: 'Electrical and Electronics Engineering', atUniAbuja: true, image: asset('electrical.jpg'),
    summary: 'Generates, transmits and uses electrical power, and designs the electronics and communication systems around us.',
    work: ['Power generation, transmission and distribution', 'Electronics and embedded systems', 'Telecommunications', 'Control and instrumentation', 'Renewable energy and solar systems'],
    careers: ['Power generation and distribution companies', 'Telecom operators', 'Oil, gas and manufacturing plants', 'Renewable energy companies', 'Electronics design and repair'],
    bodies: ['Nigerian Institution of Electrical and Electronic Engineers (NIEEE), a division of NSE', 'COREN registration'],
  },
  {
    slug: 'mechanical', name: 'Mechanical Engineering', atUniAbuja: true, image: asset('mechanical.jpg'), logo: asset('logo-nimeche.jpg'),
    summary: 'Designs and maintains machines, engines, vehicles, plants and the systems that move energy and heat.',
    work: ['Machine and product design', 'Thermodynamics, heating and cooling', 'Automotive and production engineering', 'Plant maintenance and reliability', 'Manufacturing processes'],
    careers: ['Manufacturing and assembly plants', 'Oil and gas', 'Automotive and heavy equipment', 'Power plants', 'Building services (HVAC)'],
    bodies: ['Nigerian Institution of Mechanical Engineers (NIMechE), a division of NSE', 'COREN registration'],
  },
  {
    slug: 'chemical', name: 'Chemical Engineering', atUniAbuja: true, image: asset('chemical.jpg'), logo: asset('logo-nsche.png'),
    summary: 'Turns raw materials into useful products at scale: fuels, food, medicines, plastics, fertiliser and clean water.',
    work: ['Process design and plant operations', 'Petroleum refining and petrochemicals', 'Food and pharmaceutical processing', 'Environmental and waste treatment', 'Materials and polymers'],
    careers: ['Refineries and petrochemical plants', 'Food, beverage and drug manufacturers', 'Cement, fertiliser and chemical plants', 'Environmental consulting', 'Research institutes'],
    bodies: ['Nigerian Society of Chemical Engineers (NSChE), a division of NSE', 'COREN registration'],
  },
  {
    slug: 'agricultural', name: 'Agricultural Engineering', atUniAbuja: true, image: asset('agricultural.jpg'),
    summary: 'Applies engineering to farming: machinery, irrigation, storage and processing that help Nigeria feed itself.',
    work: ['Farm power and machinery', 'Irrigation and soil and water conservation', 'Crop processing and storage', 'Agricultural structures', 'Food engineering'],
    careers: ['Agro-processing companies', 'Irrigation and river basin projects', 'Farm equipment suppliers', 'Research institutes and ADPs', 'Agribusiness start-ups'],
    bodies: ['Nigerian Institution of Agricultural Engineers (NIAE), a division of NSE', 'COREN registration'],
  },
  {
    slug: 'aeronautical', name: 'Aeronautical Engineering', atUniAbuja: true, image: asset('aeronautical.jpg'),
    summary: 'Designs, builds and maintains aircraft and the systems that keep them flying safely.',
    work: ['Aerodynamics and flight mechanics', 'Aircraft structures and materials', 'Propulsion and engines', 'Avionics', 'Aircraft maintenance and airworthiness'],
    careers: ['Airlines and maintenance organisations', 'Nigerian Air Force and defence industry', 'Aviation regulators and agencies', 'Airports', 'Drone and aerospace start-ups'],
    bodies: ['Nigerian Institution of Aerospace Engineers, a division of NSE', 'COREN registration'],
  },
  {
    slug: 'railway', name: 'Railway Engineering', atUniAbuja: true, image: asset('railway.jpg'),
    summary: 'Builds and runs rail systems: track, rolling stock, signalling and the operations behind Nigeria\'s growing rail network.',
    work: ['Track design and maintenance', 'Rolling stock (locomotives and coaches)', 'Signalling and train control', 'Railway operations and safety', 'Urban and light rail systems'],
    careers: ['Nigerian Railway Corporation', 'Rail construction contractors', 'Urban mass transit projects', 'Ministries of transportation', 'Rolling stock maintenance'],
    bodies: ['COREN registration'],
  },
  {
    slug: 'petroleum', name: 'Petroleum Engineering', atUniAbuja: false, image: asset('petroleum.jpg'),
    summary: 'Finds and produces oil and gas safely and efficiently, from reservoir to wellhead.',
    work: ['Drilling engineering', 'Reservoir engineering', 'Production engineering', 'Well testing and completion'],
    careers: ['Oil and gas operators', 'Oilfield service companies', 'Regulatory agencies'],
    bodies: ['COREN registration'],
  },
  {
    slug: 'computer', name: 'Computer Engineering', atUniAbuja: false, image: asset('computer.jpg'),
    summary: 'Sits between electronics and software: computer hardware, networks and embedded systems.',
    work: ['Computer architecture and hardware', 'Embedded systems and IoT', 'Networks and security', 'Software for devices'],
    careers: ['Tech companies', 'Telecoms', 'Banks and fintech', 'Hardware and IoT start-ups'],
    bodies: ['COREN registration'],
  },
  {
    slug: 'metallurgical', name: 'Metallurgical and Materials Engineering', atUniAbuja: false, image: asset('metallurgical.jpg'),
    summary: 'Extracts and processes metals and develops the materials that everything else is built from.',
    work: ['Extractive metallurgy', 'Materials testing and selection', 'Corrosion engineering', 'Foundry and steel making'],
    careers: ['Steel and foundry plants', 'Mining', 'Oil and gas (corrosion)', 'Manufacturing'],
    bodies: ['COREN registration'],
  },
  {
    slug: 'mining', name: 'Mining Engineering', atUniAbuja: false, image: asset('mining.jpg'),
    summary: 'Plans and runs the safe extraction of solid minerals, a growing part of Nigeria\'s economy.',
    work: ['Mine planning and design', 'Mineral processing', 'Mine safety and ventilation', 'Environmental management'],
    careers: ['Mining companies', 'Quarries', 'Mines inspectorate and regulators'],
    bodies: ['COREN registration'],
  },
  {
    slug: 'biomedical', name: 'Biomedical Engineering', atUniAbuja: false, image: asset('lab.jpg'),
    summary: 'Designs and maintains medical devices and healthcare technology.',
    work: ['Medical devices and equipment', 'Biomaterials', 'Clinical engineering in hospitals', 'Medical imaging'],
    careers: ['Hospitals', 'Medical equipment suppliers', 'Health tech start-ups'],
    bodies: ['COREN registration'],
  },
];

export const REGISTRATION_STEPS = [
  { title: 'Study an accredited programme', text: 'Earn a B.Eng or B.Sc (Engineering) from a programme accredited by COREN and the NUC. Each of the seven UniAbuja departments runs a five year B.Eng.' },
  { title: 'Complete SIWES', text: 'The Students Industrial Work Experience Scheme (run by the ITF) places you in industry during your programme. Keep your logbook and reports well; they count.' },
  { title: 'Join NSE as a student or graduate member', text: 'NUESA members are engineering students; after graduation you can join the Nigerian Society of Engineers as a graduate member and attend branch activities.' },
  { title: 'Gain supervised experience', text: 'Work under registered engineers and build a record of the projects you contributed to.' },
  { title: 'Become a corporate member (MNSE)', text: 'After the required experience, apply for corporate membership through the NSE professional interview.' },
  { title: 'Register with COREN', text: 'Only engineers registered with COREN may practise and sign off engineering work in Nigeria. Registration gives you the right to use the title Engr.' },
];

export const USEFUL_LINKS: { label: string; url: string; note: string; short: string; logo?: string }[] = [
  { label: 'Nigerian Society of Engineers (NSE)', logo: 'NSE', short: 'NSE', url: 'https://nse.org.ng', note: 'Membership, branches, divisions and news' },
  { label: 'COREN', logo: 'COREN', short: 'COREN', url: 'https://coren.gov.ng', note: 'Registration of engineers and accreditation' },
  { label: 'Industrial Training Fund (SIWES)', short: 'ITF', url: 'https://itf.gov.ng', note: 'SIWES placement and logbooks' },
  { label: 'National Universities Commission', short: 'NUC', url: 'https://nuc.edu.ng', note: 'Approved universities and programmes' },
  { label: 'University of Abuja', short: 'UNI', url: 'https://uniabuja.edu.ng', note: 'Official university website' },
];

export const FAQS = [
  { q: 'What is NUESA?', a: 'The Nigerian Universities Engineering Students\' Association brings together engineering students in Nigerian universities. Each university has a chapter; this site is home to the University of Abuja chapter.' },
  { q: 'How is NUESA different from NSE and COREN?', a: 'NUESA is for students. The Nigerian Society of Engineers (NSE) is the professional body for engineers, founded in 1958, with 93 branches and 25 divisions. COREN is the government regulator that registers engineers and accredits programmes.' },
  { q: 'Who can use the student portal?', a: 'Students and lecturers of the Faculty of Engineering, University of Abuja. Apply for an account, verify your email with the 6 digit code, then wait for an administrator to approve you.' },
  { q: 'Where do the news headlines come from?', a: 'The news page collects engineering headlines from Nigerian and international news sites every couple of hours. Tap any headline to read the full story on the publisher\'s website.' },
  { q: 'Can I write for the blog?', a: 'Yes. Send your article idea through the Feedback page in the portal, or speak to the NUESA executives. Articles are reviewed before they are published.' },
];
