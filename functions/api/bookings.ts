type BookingPayload = Record<string, unknown>;

type Booking = {
  id: string;
  ownerName: string;
  dogName: string;
  dogSize: "small" | "big";
  phone: string;
  email: string;
  date: string;
  time: string;
  rawTime: string;
  address: string;
  serviceArea: string;
  notes: string;
  price: number;
  day: string;
  pickupWindow: string;
  serviceWindow: string;
  dogSizeLabel: string;
  status: "Booked";
  createdAt: string;
};

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<unknown>;
};

type Env = {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
};

type PagesContext = {
  request: Request;
  env: Env;
};

const ALLOWED_ORIGINS = new Set([
  "https://walking-paw.pages.dev",
  "https://walking-paw.netlify.app",
  "https://localhost",
  "http://localhost",
  "capacitor://localhost"
]);

const serviceSchedule: Record<
  string,
  { start: string; end: string; lastPickup: string; display: string; pickupWindow: string }
> = {
  Monday: {
    start: "16:30",
    end: "17:30",
    lastPickup: "17:15",
    display: "4:30 PM - 5:30 PM",
    pickupWindow: "4:30 PM - 5:15 PM"
  },
  Wednesday: {
    start: "17:40",
    end: "18:30",
    lastPickup: "18:15",
    display: "5:40 PM - 6:30 PM",
    pickupWindow: "5:40 PM - 6:15 PM"
  },
  Friday: {
    start: "17:40",
    end: "18:30",
    lastPickup: "18:15",
    display: "5:40 PM - 6:30 PM",
    pickupWindow: "5:40 PM - 6:15 PM"
  },
  Saturday: {
    start: "13:00",
    end: "17:30",
    lastPickup: "17:15",
    display: "1:00 PM - 5:30 PM",
    pickupWindow: "1:00 PM - 5:15 PM"
  },
  Sunday: {
    start: "13:00",
    end: "17:30",
    lastPickup: "17:15",
    display: "1:00 PM - 5:30 PM",
    pickupWindow: "1:00 PM - 5:15 PM"
  }
};

const priceBySize = {
  small: 5,
  big: 10
} as const;

let schemaReady: Promise<void> | null = null;

function isAllowedOrigin(origin: string) {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === "https:" && hostname.endsWith(".walking-paw.pages.dev");
  } catch {
    return false;
  }
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  if (!origin || !isAllowedOrigin(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type, x-admin-password",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Vary": "Origin"
  };
}

function json(req: Request, data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      ...corsHeaders(req),
      "Cache-Control": "no-store"
    }
  });
}

function empty(req: Request, status = 204) {
  return new Response(null, { status, headers: corsHeaders(req) });
}

function getDb(env: Env) {
  if (!env.DB) {
    throw new Error("Cloudflare D1 database is not connected yet.");
  }
  return env.DB;
}

function ensureSchema(db: D1Database) {
  schemaReady ||= Promise.all([
    db
      .prepare(
        `CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`
      )
      .run(),
    db
      .prepare("CREATE INDEX IF NOT EXISTS bookings_created_at_idx ON bookings (created_at DESC)")
      .run()
  ])
    .then(() => undefined);
  return schemaReady;
}

function getAdminPassword(env: Env) {
  return env.ADMIN_PASSWORD || "";
}

function isAdminRequest(req: Request, env: Env) {
  const configuredPassword = getAdminPassword(env);
  const providedPassword = req.headers.get("x-admin-password") || "";
  return Boolean(configuredPassword) && providedPassword === configuredPassword;
}

function cleanText(value: unknown, maxLength = 180) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function getDayName(dateValue: string) {
  if (!dateValue) return "";
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date(`${dateValue}T12:00:00`)
  );
}

function minutesFromTime(timeValue: string) {
  const [hours, minutes] = timeValue.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatPickupTime(timeValue: string) {
  const [hours, minutes] = timeValue.split(":").map(Number);
  const displayHour = hours % 12 || 12;
  const period = hours >= 12 ? "PM" : "AM";
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function validatePickupTime(day: string, timeValue: string) {
  const windowForDay = serviceSchedule[day];
  if (!day || !windowForDay) {
    return "Please choose Monday, Wednesday, Friday, Saturday, or Sunday. We do not book Tuesdays or Thursdays.";
  }
  if (!timeValue) {
    return "Please type the pickup time you want.";
  }

  const picked = minutesFromTime(timeValue);
  const start = minutesFromTime(windowForDay.start);
  const lastPickup = minutesFromTime(windowForDay.lastPickup);

  if (picked < start || picked > lastPickup) {
    return `${day} pickup times must be between ${windowForDay.pickupWindow}.`;
  }

  return "";
}

function buildBooking(payload: BookingPayload): Booking {
  const dogSize = payload.dogSize === "big" ? "big" : "small";
  const date = cleanText(payload.date, 10);
  const rawTime = cleanText(payload.rawTime || payload.time, 5);
  const day = getDayName(date);
  const selectedWindow = serviceSchedule[day];
  const pickupError = validatePickupTime(day, rawTime);
  const ownerName = cleanText(payload.ownerName);
  const dogName = cleanText(payload.dogName);
  const phone = cleanText(payload.phone, 40);
  const address = cleanText(payload.address, 240);

  const missing = [
    [ownerName, "Please enter the owner's name."],
    [dogName, "Please enter the dog's name."],
    [phone, "Please enter a phone number."],
    [date, "Please choose a walk date."],
    [address, "Please enter the Beaumont-side address or meet spot."]
  ].find(([value]) => !String(value).trim());

  if (missing) {
    throw new Error(String(missing[1]));
  }

  if (payload.areaConfirmed !== true) {
    throw new Error("Please confirm the walk is in the Beaumont side of Lexington, Kentucky.");
  }

  if (pickupError) {
    throw new Error(pickupError);
  }

  return {
    id: crypto.randomUUID(),
    ownerName,
    dogName,
    dogSize,
    phone,
    email: cleanText(payload.email, 140),
    date,
    time: formatPickupTime(rawTime),
    rawTime,
    address,
    serviceArea: cleanText(payload.serviceArea, 120) || "Beaumont Park / Lexington, KY",
    notes: cleanText(payload.notes, 500),
    price: priceBySize[dogSize],
    day,
    pickupWindow: selectedWindow.pickupWindow,
    serviceWindow: selectedWindow.display,
    dogSizeLabel: dogSize === "small" ? "Small Dog" : "Big Dog",
    status: "Booked",
    createdAt: new Date().toISOString()
  };
}

async function listBookings(db: D1Database) {
  const { results = [] } = await db
    .prepare("SELECT data FROM bookings ORDER BY created_at DESC")
    .all<{ data: string }>();

  return results
    .map(({ data }) => {
      try {
        return JSON.parse(data) as Booking;
      } catch {
        return null;
      }
    })
    .filter((booking): booking is Booking => Boolean(booking));
}

async function saveBooking(db: D1Database, payload: BookingPayload) {
  const booking = buildBooking(payload);
  await db
    .prepare("INSERT INTO bookings (id, created_at, data) VALUES (?, ?, ?)")
    .bind(booking.id, booking.createdAt, JSON.stringify(booking))
    .run();
  return booking;
}

async function deleteBooking(db: D1Database, id: string) {
  await db.prepare("DELETE FROM bookings WHERE id = ?").bind(id).run();
}

async function clearBookings(db: D1Database) {
  await db.prepare("DELETE FROM bookings").run();
}

export async function onRequest(context: PagesContext) {
  const { request, env } = context;

  try {
    if (request.method === "OPTIONS") {
      return empty(request);
    }

    const db = getDb(env);
    await ensureSchema(db);

    if (request.method === "POST") {
      const booking = await saveBooking(db, await request.json());
      return json(request, { booking }, 201);
    }

    if (request.method === "GET") {
      if (!isAdminRequest(request, env)) {
        return json(request, { error: "Wrong admin password." }, 401);
      }
      return json(request, { bookings: await listBookings(db) });
    }

    if (request.method === "DELETE") {
      if (!isAdminRequest(request, env)) {
        return json(request, { error: "Wrong admin password." }, 401);
      }

      const url = new URL(request.url);
      const id = url.searchParams.get("id");

      if (id) {
        await deleteBooking(db, id);
      } else {
        await clearBookings(db);
      }

      return json(request, { bookings: await listBookings(db) });
    }

    return json(request, { error: "Method not allowed." }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return json(request, { error: message }, 400);
  }
}
