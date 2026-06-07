import {
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Dog,
  Download,
  Heart,
  LockKeyhole,
  LogOut,
  MapPin,
  Menu,
  PawPrint,
  Phone,
  ShieldCheck,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const BOOKINGS_API = "/api/bookings";
const ADMIN_PASSWORD_SESSION_KEY = "walking-paw-admin-password";

const serviceSchedule = {
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
};

const navItems = [
  { id: "home", label: "Home" },
  { id: "book", label: "Book a Walk" },
  { id: "policies", label: "Policies" },
  { id: "terms", label: "Terms" }
];

const pageIds = new Set([...navItems.map((item) => item.id), "thanks"]);

const emptyForm = {
  ownerName: "",
  dogName: "",
  dogSize: "small",
  phone: "",
  email: "",
  address: "",
  serviceArea: "Beaumont Park / Lexington, KY",
  date: "",
  time: "",
  notes: "",
  areaConfirmed: false
};

function getPageFromHash() {
  const hash = window.location.hash.replace("#", "");
  return pageIds.has(hash) ? hash : "home";
}

function getDayName(dateValue) {
  if (!dateValue) return "";
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date(`${dateValue}T12:00:00`)
  );
}

function getTodayValue() {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().split("T")[0];
}

function formatDate(dateValue) {
  if (!dateValue) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${dateValue}T12:00:00`));
}

function isAdminPath() {
  return window.location.pathname.replace(/\/$/, "") === "/admin";
}

async function readApiResponse(response) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.error || "The shared booking service is unavailable right now.");
    error.status = response.status;
    throw error;
  }

  return data;
}

async function createSharedBooking(booking) {
  const data = await readApiResponse(
    await fetch(BOOKINGS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(booking)
    })
  );
  return data.booking;
}

async function fetchSharedBookings(password) {
  const data = await readApiResponse(
    await fetch(BOOKINGS_API, {
      cache: "no-store",
      headers: { "x-admin-password": password }
    })
  );
  return data.bookings || [];
}

async function deleteSharedBooking(id, password) {
  const data = await readApiResponse(
    await fetch(`${BOOKINGS_API}?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-admin-password": password }
    })
  );
  return data.bookings || [];
}

async function clearSharedBookings(password) {
  const data = await readApiResponse(
    await fetch(BOOKINGS_API, {
      method: "DELETE",
      headers: { "x-admin-password": password }
    })
  );
  return data.bookings || [];
}

function minutesFromTime(timeValue) {
  if (!timeValue) return null;
  const [hours, minutes] = timeValue.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatPickupTime(timeValue) {
  if (!timeValue) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(`2026-01-01T${timeValue}:00`));
}

function validatePickupTime(day, timeValue) {
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

function App() {
  const [adminSite, setAdminSite] = useState(isAdminPath);
  const [activePage, setActivePage] = useState(getPageFromHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const [latestBookingId, setLatestBookingId] = useState("");
  const [latestBooking, setLatestBooking] = useState(null);
  const [adminPassword, setAdminPassword] = useState(
    () => sessionStorage.getItem(ADMIN_PASSWORD_SESSION_KEY) || ""
  );

  useEffect(() => {
    const onHashChange = () => {
      setActivePage(getPageFromHash());
      setMenuOpen(false);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const onPopState = () => setAdminSite(isAdminPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!adminSite || !adminPassword) return undefined;

    let cancelled = false;
    setBookingsLoading(true);
    setBookingsError("");

    fetchSharedBookings(adminPassword)
      .then((sharedBookings) => {
        if (!cancelled) {
          setBookings(sharedBookings);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBookingsError(error.message);
          if (error.status === 401) {
            sessionStorage.removeItem(ADMIN_PASSWORD_SESSION_KEY);
            setAdminPassword("");
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBookingsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adminSite, adminPassword]);

  function navigate(page) {
    window.location.hash = page;
    setActivePage(page);
    setMenuOpen(false);
  }

  async function addBooking(booking) {
    const savedBooking = await createSharedBooking(booking);
    setBookings((current) => [savedBooking, ...current]);
    setLatestBookingId(savedBooking.id);
    setLatestBooking(savedBooking);
    navigate("thanks");
  }

  async function loginAdmin(password) {
    setBookingsLoading(true);
    setBookingsError("");
    try {
      const sharedBookings = await fetchSharedBookings(password);
      sessionStorage.setItem(ADMIN_PASSWORD_SESSION_KEY, password);
      setAdminPassword(password);
      setBookings(sharedBookings);
    } catch (error) {
      setBookingsError(error.message);
      throw error;
    } finally {
      setBookingsLoading(false);
    }
  }

  function logoutAdmin() {
    sessionStorage.removeItem(ADMIN_PASSWORD_SESSION_KEY);
    setAdminPassword("");
    setBookings([]);
    setBookingsError("");
    setLatestBookingId("");
  }

  async function deleteBooking(id) {
    if (!adminPassword) return;
    setBookingsLoading(true);
    setBookingsError("");
    try {
      setBookings(await deleteSharedBooking(id, adminPassword));
      if (id === latestBookingId) {
        setLatestBookingId("");
      }
    } catch (error) {
      setBookingsError(error.message);
    } finally {
      setBookingsLoading(false);
    }
  }

  async function clearBookings() {
    if (!adminPassword) return;
    const shouldClear = window.confirm("Clear every saved Walking Paw booking?");
    if (shouldClear) {
      setBookingsLoading(true);
      setBookingsError("");
      try {
        setBookings(await clearSharedBookings(adminPassword));
        setLatestBookingId("");
      } catch (error) {
        setBookingsError(error.message);
      } finally {
        setBookingsLoading(false);
      }
    }
  }

  function downloadCsv() {
    const headers = [
      "Owner",
      "Dog",
      "Size",
      "Phone",
      "Email",
      "Address",
      "Service Area",
      "Date",
      "Day",
      "Pickup Time",
      "Pickup Window",
      "Price",
      "Notes",
      "Status",
      "Created"
    ];
    const rows = bookings.map((booking) => [
      booking.ownerName,
      booking.dogName,
      booking.dogSizeLabel,
      booking.phone,
      booking.email,
      booking.address,
      booking.serviceArea,
      booking.date,
      booking.day,
      booking.time,
      booking.pickupWindow || booking.serviceWindow,
      `$${booking.price}`,
      booking.notes,
      booking.status,
      booking.createdAt
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value || "").replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "walking-paw-bookings.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (adminSite) {
    return (
      <AdminSite
        bookings={bookings}
        bookingsError={bookingsError}
        isAuthed={Boolean(adminPassword)}
        isLoading={bookingsLoading}
        latestBookingId={latestBookingId}
        onClear={clearBookings}
        onDelete={deleteBooking}
        onDownload={downloadCsv}
        onLogin={loginAdmin}
        onLogout={logoutAdmin}
      />
    );
  }

  return (
    <div className="app">
      <SiteHeader
        activePage={activePage}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((open) => !open)}
        onNavigate={navigate}
      />
      <CashOnlyBanner />

      <main>
        {activePage === "home" && (
          <HomePage
            onBookNow={() => navigate("book")}
            onSubmit={addBooking}
          />
        )}
        {activePage === "book" && <BookPage onSubmit={addBooking} />}
        {activePage === "thanks" && (
          <ConfirmationPage booking={latestBooking} onBookAnother={() => navigate("book")} />
        )}
        {activePage === "policies" && <PoliciesPage onBookNow={() => navigate("book")} />}
        {activePage === "terms" && <TermsPage onBookNow={() => navigate("book")} />}
      </main>

      <SiteFooter onNavigate={navigate} />
    </div>
  );
}

function CashOnlyBanner() {
  return (
    <aside className="cash-only-banner" aria-label="Payment notice">
      Cash Only
    </aside>
  );
}

function SiteHeader({ activePage, menuOpen, onMenuToggle, onNavigate }) {
  return (
    <header className="site-header">
      <a className="brand" href="#home" onClick={() => onNavigate("home")}>
        <span className="brand-mark" aria-hidden="true">
          <PawPrint size={25} />
        </span>
        <span>
          <strong>Walking</strong>
          <em>Paw Service</em>
        </span>
      </a>

      <button className="icon-button menu-button" type="button" onClick={onMenuToggle}>
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
        <span className="sr-only">Toggle navigation</span>
      </button>

      <nav className={menuOpen ? "nav nav-open" : "nav"} aria-label="Main navigation">
        {navItems.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={activePage === item.id ? "nav-link active" : "nav-link"}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

function HomePage({ onBookNow, onSubmit }) {
  const nextOpenDays = Object.entries(serviceSchedule);

  return (
    <>
      <section className="hero-shell">
        <div className="hero-copy">
          <div className="hero-title-row">
            <h1>Walking Paw Service</h1>
            <PawPrint className="title-paw" size={54} aria-hidden="true" />
          </div>
          <p className="hero-lede">
            Dog walking, exercise, playtime, and safe gentle care for families around
            Beaumont Park and the Beaumont side of Lexington, Kentucky only.
          </p>
          <div className="hero-actions">
            <a className="secondary-button" href="tel:8594473857">
              <Phone size={19} />
              Call Workers
            </a>
            <button className="secondary-button" type="button" onClick={onBookNow}>
              <CalendarCheck size={20} />
              Full Booking Page
            </button>
          </div>
          <BookingForm onSubmit={onSubmit} compact />
          <div className="quick-facts" aria-label="Walking Paw quick facts">
            <Fact icon={<Dog />} label="Small Dogs" value="$5" accent="teal" />
            <Fact icon={<Dog />} label="Big Dogs" value="$10" accent="orange" />
            <Fact icon={<MapPin />} label="Location" value="Beaumont, KY" accent="green" />
            <Fact icon={<LockKeyhole />} label="Worker Site" value="Locked" accent="navy" />
          </div>
        </div>

        <div className="hero-poster" aria-label="Walking Paw flyer information">
          <img src="/walking-paw-flyer.webp" alt="Walking Paw Service flyer with dogs, pricing, schedule, and contact details" />
        </div>
      </section>

      <section className="service-band">
        <div className="section-heading">
          <h2>What We Do</h2>
          <p>
            The flyer promise, turned into a simple booking site: happy dogs, happy
            owners, and a local Beaumont-only route.
          </p>
        </div>
        <div className="service-list">
          <ServiceItem icon={<Dog />} title="Dog Walking" text="Friendly walks for small and big dogs using the prices from the flyer." />
          <ServiceItem icon={<Heart />} title="Exercise & Playtime" text="Movement, fresh air, and calm attention while your dog gets out and about." />
          <ServiceItem icon={<ShieldCheck />} title="Safe, Gentle Care" text="Owners provide toys and key dog-care details before the walk." />
        </div>
      </section>

      <section className="schedule-location">
        <div className="location-panel">
          <MapPin size={30} aria-hidden="true" />
          <h2>Beaumont Park, Lexington Only</h2>
          <p>
            Walking Paw Service currently books walks only in Kentucky, around Beaumont
            Park and the Beaumont side of Lexington.
          </p>
        </div>
        <div className="schedule-panel">
          <h2>Days We Work</h2>
          <div className="schedule-grid">
            {nextOpenDays.map(([day, windowForDay]) => (
              <div className="schedule-row" key={day}>
                <strong>{day}</strong>
                <span>{windowForDay.display} · pickups {windowForDay.pickupWindow}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function BookPage({ onSubmit }) {
  return (
    <section className="page-wrap">
      <div className="page-intro">
        <h1>Book a Walk</h1>
        <p>
          Choose a flyer-approved day, then type the pickup time you want. Tuesday
          and Thursday bookings are closed.
        </p>
      </div>
      <BookingForm onSubmit={onSubmit} />
    </section>
  );
}

function BookingForm({ onSubmit, compact = false }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedDay = getDayName(form.date);
  const selectedWindow = serviceSchedule[selectedDay];
  const price = priceBySize[form.dogSize];
  const dogSizeLabel = form.dogSize === "small" ? "Small Dog" : "Big Dog";
  const pickupHint = form.date
    ? selectedWindow
      ? `Pickup window: ${selectedWindow.pickupWindow}`
      : "Closed on Tuesdays and Thursdays"
    : "Pick a date first";

  function updateField(field, value) {
    setError("");
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "date") {
        next.time = "";
      }
      return next;
    });
  }

  async function submitForm(event) {
    event.preventDefault();
    const pickupError = validatePickupTime(selectedDay, form.time);
    const missingField = [
      ["ownerName", "Please enter the owner's name."],
      ["dogName", "Please enter the dog's name."],
      ["phone", "Please enter a phone number."],
      ["date", "Please choose a walk date."],
      ["address", "Please enter the Beaumont-side address or meet spot."]
    ].find(([field]) => !String(form[field]).trim());

    if (missingField) {
      setError(missingField[1]);
      return;
    }
    if (!form.areaConfirmed) {
      setError("Please confirm the walk is in the Beaumont side of Lexington, Kentucky.");
      return;
    }
    if (pickupError) {
      setError(pickupError);
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        ...form,
        price,
        day: selectedDay,
        pickupWindow: selectedWindow.pickupWindow,
        serviceWindow: selectedWindow.display,
        rawTime: form.time,
        time: formatPickupTime(form.time),
        dogSizeLabel
      });
      setForm(emptyForm);
    } catch (saveError) {
      setError(saveError.message || "Could not save this booking. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className={compact ? "booking-form compact-booking-form" : "booking-form"}
      noValidate
      onSubmit={submitForm}
    >
      <div className="form-grid">
        <label>
          Owner Name
          <input
            required
            value={form.ownerName}
            onChange={(event) => updateField("ownerName", event.target.value)}
            placeholder="Your name"
          />
        </label>
        <label>
          Dog Name
          <input
            required
            value={form.dogName}
            onChange={(event) => updateField("dogName", event.target.value)}
            placeholder="Dog's name"
          />
        </label>
        <label>
          Dog Size
          <select
            value={form.dogSize}
            onChange={(event) => updateField("dogSize", event.target.value)}
          >
            <option value="small">Small Dog - $5</option>
            <option value="big">Big Dog - $10</option>
          </select>
        </label>
        <label>
          Phone
          <input
            required
            type="tel"
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="(859) 000-0000"
          />
        </label>
        {!compact && (
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="Optional"
            />
          </label>
        )}
        <label>
          Walk Date
          <input
            required
            type="date"
            min={getTodayValue()}
            value={form.date}
            onChange={(event) => updateField("date", event.target.value)}
          />
        </label>
        <label>
          Pickup Time
          <input
            required
            type="time"
            min={selectedWindow?.start || undefined}
            max={selectedWindow?.lastPickup || undefined}
            step="60"
            disabled={!selectedWindow}
            value={form.time}
            onChange={(event) => updateField("time", event.target.value)}
          />
          <span className={!form.date || selectedWindow ? "field-hint" : "field-hint closed"}>
            {pickupHint}
          </span>
        </label>
        <label className="wide-field">
          Beaumont-Side Address or Meet Spot
          <input
            required
            value={form.address}
            onChange={(event) => updateField("address", event.target.value)}
            placeholder="Beaumont Park or Beaumont-side Lexington address"
          />
        </label>
        <label className="wide-field">
          Service Area
          <select
            value={form.serviceArea}
            onChange={(event) => updateField("serviceArea", event.target.value)}
          >
            <option>Beaumont Park / Lexington, KY</option>
            <option>Beaumont Centre / Lexington, KY</option>
            <option>Harrods Hill / Lexington, KY</option>
          </select>
        </label>
        {!compact && (
          <label className="wide-field">
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Leash details, toy notes, temperament, pickup instructions"
            />
          </label>
        )}
      </div>

      <label className="confirm-row">
        <input
          required
          type="checkbox"
          checked={form.areaConfirmed}
          onChange={(event) => updateField("areaConfirmed", event.target.checked)}
        />
        <span>
          I confirm this walk is in Kentucky and on the Beaumont side of Lexington.
        </span>
      </label>

      <div className="form-summary">
        <div>
          <span>Total</span>
          <strong>${price}</strong>
        </div>
        <div>
          <span>Selected Day</span>
          <strong>{selectedDay && selectedWindow ? selectedDay : "Pick a date"}</strong>
        </div>
        <div>
          <span>Dog Size</span>
          <strong>{dogSizeLabel}</strong>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <button className="primary-button submit-button" type="submit" disabled={saving}>
        <CheckCircle2 size={20} />
        {saving ? "Saving Booking" : "Save Booking"}
      </button>
    </form>
  );
}

function ConfirmationPage({ booking, onBookAnother }) {
  return (
    <section className="page-wrap confirmation-page">
      <div className="confirmation-panel">
        <CheckCircle2 size={48} aria-hidden="true" />
        <h1>Walk Request Saved</h1>
        {booking ? (
          <p>
            {booking.dogName} is booked for {formatDate(booking.date)} at{" "}
            {booking.time}. Workers and bosses can see this in the locked admin site.
          </p>
        ) : (
          <p>Your walk request was saved. Workers and bosses can see it in the locked admin site.</p>
        )}
        <div className="confirmation-actions">
          <button className="primary-button" type="button" onClick={onBookAnother}>
            <CalendarCheck size={20} />
            Book Another Walk
          </button>
          <a className="secondary-button" href="/admin">
            <LockKeyhole size={19} />
            Worker/Boss Login
          </a>
        </div>
      </div>
    </section>
  );
}

function AdminSite({
  bookings,
  bookingsError,
  isAuthed,
  isLoading,
  latestBookingId,
  onDelete,
  onClear,
  onDownload,
  onLogin,
  onLogout
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitPassword(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onLogin(password);
      setError("");
    } catch (loginError) {
      setError(loginError.message || "Wrong password. Workers and bosses should use the correct login password.");
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    onLogout();
    setPassword("");
  }

  if (!isAuthed) {
    return (
      <div className="admin-app login-view">
        <a className="brand admin-brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            <PawPrint size={25} />
          </span>
          <span>
            <strong>Walking</strong>
            <em>Paw Service</em>
          </span>
        </a>

        <form className="login-panel" onSubmit={submitPassword}>
          <LockKeyhole size={42} aria-hidden="true" />
          <h1>Worker & Boss Login</h1>
          <p>Enter the password to see dogs that have been booked for walks.</p>
          <label>
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(event) => {
                setError("");
                setPassword(event.target.value);
              }}
              placeholder="Enter password"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button submit-button" type="submit" disabled={submitting}>
            <LockKeyhole size={20} />
            {submitting ? "Checking" : "Log In"}
          </button>
          <a className="login-back" href="/">
            Back to public booking site
          </a>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-app">
      <header className="admin-header">
        <a className="brand admin-brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            <PawPrint size={25} />
          </span>
          <span>
            <strong>Walking</strong>
            <em>Paw Service</em>
          </span>
        </a>
        <div className="admin-header-actions">
          <a className="secondary-button" href="/">
            Public Site
          </a>
          <button className="ghost-danger" type="button" onClick={logout}>
            <LogOut size={18} />
            Log Out
          </button>
        </div>
      </header>

      <main>
        <BookingsPage
          admin
          bookings={bookings}
          bookingsError={bookingsError}
          isLoading={isLoading}
          latestBookingId={latestBookingId}
          onBookNow={() => {
            window.location.href = "/#book";
          }}
          onDelete={onDelete}
          onClear={onClear}
          onDownload={onDownload}
        />
      </main>
    </div>
  );
}

function BookingsPage({
  bookings,
  bookingsError = "",
  isLoading = false,
  latestBookingId,
  onBookNow,
  onDelete,
  onClear,
  onDownload,
  admin = false
}) {
  const totals = useMemo(() => {
    return bookings.reduce(
      (summary, booking) => {
        summary.total += booking.price;
        summary[booking.dogSize] += 1;
        return summary;
      },
      { total: 0, small: 0, big: 0 }
    );
  }, [bookings]);

  return (
    <section className="page-wrap">
      <div className="page-intro bookings-intro">
        <div>
          <h1>{admin ? "Worker & Boss Booked Dogs" : "People Who Booked a Walk"}</h1>
          <p>
            {admin
              ? "Password-protected view for booked dogs, pickup times, owner contacts, and Beaumont-side locations."
              : "These bookings are saved on this browser for Walking Paw Service. Add a booking from the form and it appears here."}
          </p>
        </div>
        <button className="primary-button" type="button" onClick={onBookNow}>
          <CalendarCheck size={20} />
          New Booking
        </button>
      </div>

      <div className="booking-stats">
        <Stat label="Bookings" value={bookings.length} />
        <Stat label="Small Dogs" value={totals.small} />
        <Stat label="Big Dogs" value={totals.big} />
        <Stat label="Total Price" value={`$${totals.total}`} />
      </div>

      <div className="booking-actions">
        <button className="secondary-button" type="button" onClick={onDownload} disabled={!bookings.length || isLoading}>
          <Download size={18} />
          Export CSV
        </button>
        <button className="ghost-danger" type="button" onClick={onClear} disabled={!bookings.length || isLoading}>
          <Trash2 size={18} />
          Clear All
        </button>
      </div>

      {bookingsError && <p className="form-error admin-error">{bookingsError}</p>}

      <div className="bookings-table-wrap">
        {isLoading ? (
          <div className="empty-state">
            <ClipboardList size={44} aria-hidden="true" />
            <h2>Loading bookings</h2>
            <p>Checking the shared Walking Paw booking list.</p>
          </div>
        ) : bookings.length ? (
          <table className="bookings-table">
            <thead>
              <tr>
                <th>Owner</th>
                <th>Dog</th>
                <th>Walk</th>
                <th>Location</th>
                <th>Contact</th>
                <th>Price</th>
                <th>Status</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className={booking.id === latestBookingId ? "new-row" : ""}>
                  <td>
                    <strong>{booking.ownerName}</strong>
                    <span>{booking.email || "No email"}</span>
                  </td>
                  <td>
                    <strong>{booking.dogName}</strong>
                    <span>{booking.dogSizeLabel}</span>
                  </td>
                  <td>
                    <strong>{formatDate(booking.date)}</strong>
                    <span>
                      {booking.day}, pickup {booking.time}
                    </span>
                    <span>{booking.pickupWindow || booking.serviceWindow}</span>
                  </td>
                  <td>
                    <strong>{booking.serviceArea}</strong>
                    <span>{booking.address}</span>
                  </td>
                  <td>
                    <a href={`tel:${booking.phone}`}>{booking.phone}</a>
                  </td>
                  <td>
                    <strong>${booking.price}</strong>
                  </td>
                  <td>
                    <span className="status-pill">{booking.status}</span>
                  </td>
                  <td>
                    <button
                      className="icon-button danger-icon"
                      type="button"
                      disabled={isLoading}
                      onClick={() => onDelete(booking.id)}
                    >
                      <Trash2 size={18} />
                      <span className="sr-only">Delete booking</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <ClipboardList size={44} aria-hidden="true" />
            <h2>No walks booked yet</h2>
            <p>Use the booking form to save the first Beaumont-side walk.</p>
            <button className="primary-button" type="button" onClick={onBookNow}>
              <CalendarCheck size={20} />
              Book a Walk
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function PoliciesPage({ onBookNow }) {
  return (
    <section className="page-wrap legal-page">
      <div className="page-intro">
        <h1>Policies</h1>
        <p>
          Walking Paw Service is a local Beaumont-side Lexington dog walking service.
          These policies keep the booking clear for owners, dogs, and walkers.
        </p>
      </div>

      <div className="legal-grid">
        <LegalBlock
          title="Service Area"
          text="Walks are available only in Kentucky, around Beaumont Park and the Beaumont side of Lexington. Addresses outside this area are not accepted."
        />
        <LegalBlock
          title="Dog Care"
          text="Walking Paw Service provides dog walking, exercise, playtime, and safe gentle care. Owners must share leash, health, temperament, and pickup details before the walk."
        />
        <LegalBlock
          title="Toys"
          text="Toys need to be provided by owners, as listed on the Walking Paw flyer."
        />
        <LegalBlock
          title="Pricing"
          text="Small dogs are $5 and big dogs are $10 per booked walk slot. The price shown on the booking form is the amount for that booking."
        />
        <LegalBlock
          title="Schedule"
          text="Bookings are closed on Tuesdays and Thursdays. Pickup times can be typed for Monday 4:30-5:15, Wednesday 5:40-6:15, Friday 5:40-6:15, Saturday 1:00-5:15, and Sunday 1:00-5:15."
        />
        <LegalBlock
          title="Weather and Safety"
          text="Walks may be rescheduled or shortened if weather, unsafe conditions, or a dog's behavior makes a walk unsafe."
        />
      </div>

      <button className="primary-button legal-cta" type="button" onClick={onBookNow}>
        <CalendarCheck size={20} />
        Book a Walk
      </button>
    </section>
  );
}

function TermsPage({ onBookNow }) {
  return (
    <section className="page-wrap legal-page">
      <div className="page-intro">
        <h1>Terms</h1>
        <p>
          By booking a walk, owners agree to the Walking Paw Service area,
          schedule, pricing, and owner responsibility rules.
        </p>
      </div>

      <div className="terms-panel">
        <ol>
          <li>
            Walking Paw Service accepts bookings only for Beaumont Park and the
            Beaumont side of Lexington, Kentucky.
          </li>
          <li>
            The owner must provide accurate contact information, the dog&apos;s name,
            dog size, address or meet spot, and any notes needed for safe care.
          </li>
          <li>
            Owners are responsible for providing toys and for making sure the dog has
            a suitable leash, collar, harness, or other normal walking equipment.
          </li>
          <li>
            The listed prices are $5 for small dogs and $10 for big dogs. Payment and
            final walk details are handled directly with Walking Paw Service.
          </li>
          <li>
            Walking Paw Service may decline, cancel, or reschedule a walk when the
            booking is outside the service area, outside the available schedule, or
            unsafe for the dog or walker.
          </li>
          <li>
            Tuesday and Thursday bookings are not accepted. Pickup times must stay
            inside the day&apos;s allowed window and cannot be too close to closing time.
          </li>
          <li>
            Walking Paw Service is not a veterinary, emergency, boarding, or training
            service. In an emergency, the owner or local emergency services should be
            contacted immediately.
          </li>
          <li>
            Booking records are stored in this browser for this website version. Do
            not enter private information that should not be saved on this computer.
          </li>
        </ol>
      </div>

      <button className="primary-button legal-cta" type="button" onClick={onBookNow}>
        <CalendarCheck size={20} />
        Book a Walk
      </button>
    </section>
  );
}

function SiteFooter({ onNavigate }) {
  return (
    <footer className="site-footer">
      <div>
        <strong>Walking Paw Service</strong>
        <span>Beaumont Park in Lexington, Kentucky only</span>
      </div>
      <div className="footer-links">
        <a href="tel:8594473857">Workers: (859) 447-3857</a>
        <a href="tel:8592377087">Bosses: (859) 237-7087</a>
        <a href="/admin">Worker/Boss Login</a>
        <button type="button" onClick={() => onNavigate("policies")}>
          Policies
        </button>
        <button type="button" onClick={() => onNavigate("terms")}>
          Terms
        </button>
      </div>
    </footer>
  );
}

function Fact({ icon, label, value, accent }) {
  return (
    <div className={`fact fact-${accent}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ServiceItem({ icon, title, text }) {
  return (
    <article className="service-item">
      <span className="service-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LegalBlock({ title, text }) {
  return (
    <article className="legal-block">
      <h2>{title}</h2>
      <p>{text}</p>
    </article>
  );
}

export default App;
