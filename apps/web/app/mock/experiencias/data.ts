// Datos de ejemplo para el mock de Experiencias (sin base de datos).

export const IMG = {
  cascada: "/mock/experiencias/cascada.jpg",
  sendero: "/mock/experiencias/sendero.jpg",
  aves: "/mock/experiencias/aves.jpg",
  taller: "/mock/experiencias/taller.jpg",
};

export const TYPES = [
  { id: "senderismo", label: "Senderismo", emoji: "🥾" },
  { id: "cascadas", label: "Cascadas", emoji: "💦" },
  { id: "aves", label: "Aves", emoji: "🐦" },
  { id: "cielo", label: "Cielo nocturno", emoji: "🌌" },
  { id: "bici", label: "Bici de montaña", emoji: "🚵" },
  { id: "campismo", label: "Campismo", emoji: "🏕️" },
  { id: "talleres", label: "Talleres", emoji: "🏺" },
  { id: "gastronomia", label: "Gastronomía", emoji: "🍳" },
  { id: "cabalgatas", label: "Cabalgatas", emoji: "🐴" },
] as const;
export type TypeId = (typeof TYPES)[number]["id"];
export const typeOf = (id: TypeId) => TYPES.find((t) => t.id === id)!;

export type Experience = {
  slug: string;
  title: string;
  type: TypeId;
  municipality: string;
  place: string;
  img: string;
  gallery: string[];
  duration: string;
  distance?: string;
  difficulty?: "Fácil" | "Moderada" | "Difícil";
  price: string;
  availability: string;
  /** salidas con fecha que genera la experiencia (son eventos) */
  upcoming: number;
};

export const EXPERIENCES: Experience[] = [
  {
    slug: "cascada-los-diamantes", title: "Ruta Cascada Los Diamantes", type: "senderismo",
    municipality: "Tlalmanalco", place: "San Rafael", img: IMG.cascada, gallery: [IMG.cascada, IMG.sendero, IMG.aves],
    duration: "3–4 h", distance: "7 km", difficulty: "Moderada", price: "$50 acceso", availability: "Todos los días", upcoming: 3,
  },
  {
    slug: "aves-dos-aguas", title: "Avistamiento de aves al amanecer", type: "aves",
    municipality: "Tlalmanalco", place: "Parque Dos Aguas", img: IMG.aves, gallery: [IMG.aves],
    duration: "2 h 30 min", difficulty: "Fácil", price: "$180 con guía", availability: "Sáb y dom · 6:30", upcoming: 2,
  },
  {
    slug: "sendero-dos-aguas", title: "Sendero del bosque Dos Aguas", type: "senderismo",
    municipality: "Tlalmanalco", place: "Parque Dos Aguas", img: IMG.sendero, gallery: [IMG.sendero],
    duration: "1 h 30 min", distance: "3.5 km", difficulty: "Fácil", price: "$50 acceso", availability: "Todos los días", upcoming: 0,
  },
  {
    slug: "cascada-dinamo", title: "Cascada Dinamo", type: "cascadas",
    municipality: "Tlalmanalco", place: "San Rafael", img: IMG.cascada, gallery: [IMG.cascada],
    duration: "1 h", distance: "2 km", difficulty: "Fácil", price: "Gratis", availability: "Todos los días", upcoming: 0,
  },
  {
    slug: "taller-barro", title: "Taller de barro con artesanos", type: "talleres",
    municipality: "Amecameca", place: "Taller Tlalli", img: IMG.taller, gallery: [IMG.taller],
    duration: "2 h", difficulty: "Fácil", price: "$350", availability: "Mié a dom · 11:00 y 16:00", upcoming: 1,
  },
];

export type Dated = {
  title: string; when: string; place: string; price: string; img: string;
  /** si viene de una experiencia */
  from?: string;
  category: string;
};

export const EVENTS: Dated[] = [
  { title: "Salida guiada a Cascada Los Diamantes", when: "Sáb 18 de oct · 8:00", place: "San Rafael · Tlalmanalco", price: "$250", img: IMG.cascada, from: "Ruta Cascada Los Diamantes", category: "Salida guiada" },
  { title: "Run de Día de Muertos 5K", when: "Dom 26 de oct · 7:00", place: "Centro · Tlalmanalco", price: "$300", img: IMG.sendero, category: "Deporte" },
  { title: "Avistamiento de aves: especial migratorias", when: "Sáb 1 de nov · 6:30", place: "Parque Dos Aguas · Tlalmanalco", price: "$200", img: IMG.aves, from: "Avistamiento de aves al amanecer", category: "Salida guiada" },
];

export const PLACES = [
  { slug: "dos-aguas", name: "Parque Dos Aguas", kind: "Parque ecoturístico", experiences: 2, events: 1, img: IMG.sendero },
  { slug: "san-rafael", name: "San Rafael", kind: "Pueblo · bosque", experiences: 2, events: 1, img: IMG.cascada },
  { slug: "centro", name: "Centro de Tlalmanalco", kind: "Plaza y templo", experiences: 0, events: 1, img: IMG.taller },
];
