import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import { randomUUID } from "node:crypto";

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

declare const Netlify: {
  env: {
    get(name: string): string | undefined;
  };
};

const STORE_NAME = "walking-paw-bookings";
const BOOKING_PREFIX = "booking-";
const ALLOWED_ORIGINS = new Set([
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

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  if (!ALLOWED_ORIGINS.has(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type, x-admin-password",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Vary": "Origin"
  };
}

function json(req: Request, data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders(req) });
}

function empty(req: Request, status = 204) {
  return new Response(null, { status, headers: corsHeaders(req) });
}

function getBookingsStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function getAdminPassword() {
  return Netlify.env.get("ADMIN_PASSWORD") || "donut";
}

function isAdminRequest(req: Request) {
  const configuredPassword = getAdminPassword();
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
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(`2026-01-01T${timeValue}:00`));
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
    id: randomUUID(),
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

async function listBookings() {
  const store = getBookingsStore();
  const { blobs } = await store.list({ prefix: BOOKING_PREFIX });
  const bookings = await Promise.all(
    blobs.map(({ key }) => store.get(key, { consistency: "strong", type: "json" }))
  );

  return bookings
    .filter((booking): booking is Booking => Boolean(booking))
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

async function saveBooking(payload: BookingPayload) {
  const store = getBookingsStore();
  const booking = buildBooking(payload);
  await store.setJSON(`${BOOKING_PREFIX}${booking.id}`, booking);
  return booking;
}

async function deleteBooking(id: string) {
  const store = getBookingsStore();
  await store.delete(`${BOOKING_PREFIX}${id}`);
}

async function clearBookings() {
  const store = getBookingsStore();
  const { blobs } = await store.list({ prefix: BOOKING_PREFIX });
  await Promise.all(blobs.map(({ key }) => store.delete(key)));
}

export default async (req: Request, _context: Context) => {
  try {
    if (req.method === "OPTIONS") {
      return empty(req);
    }

    if (req.method === "POST") {
      const booking = await saveBooking(await req.json());
      return json(req, { booking }, 201);
    }

    if (req.method === "GET") {
      if (!isAdminRequest(req)) return json(req, { error: "Wrong admin password." }, 401);
      return json(req, { bookings: await listBookings() });
    }

    if (req.method === "DELETE") {
      if (!isAdminRequest(req)) return json(req, { error: "Wrong admin password." }, 401);
      const url = new URL(req.url);
      const id = url.searchParams.get("id");

      if (id) {
        await deleteBooking(id);
      } else {
        await clearBookings();
      }

      return json(req, { bookings: await listBookings() });
    }

    return json(req, { error: "Method not allowed." }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return json(req, { error: message }, 400);
  }
};

export const config: Config = {
  path: "/api/bookings"
};
