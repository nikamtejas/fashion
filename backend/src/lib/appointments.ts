import { PickupAppointment } from "../models/PickupAppointment";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { StoreLocation } from "../models/StoreLocation";
import { sendEmail } from "./mailer";

export function slotStartDate(date: Date, timeSlot: string): Date {
  const [start] = timeSlot.split("-");
  const [h, m] = start.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export function slotEndDate(date: Date, timeSlot: string): Date {
  const [, end] = timeSlot.split("-");
  const [h, m] = end.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Periodic sweep: sends the 24h and 2h reminders exactly once each, and
 * auto-flags appointments whose slot has fully passed as NO_SHOW for the
 * admin agenda. Invoked on an interval from server.ts; safe to run as
 * often as wanted (each reminder is recorded in remindersSent).
 */
export async function sweepAppointments(now = new Date()) {
  const appointments = await PickupAppointment.find({ status: { $in: ["BOOKED", "READY"] } });

  for (const appt of appointments) {
    const start = slotStartDate(appt.date, appt.timeSlot);
    const end = slotEndDate(appt.date, appt.timeSlot);
    const msToStart = start.getTime() - now.getTime();

    if (end < now) {
      appt.status = "NO_SHOW";
      await appt.save();
      continue;
    }

    const due: ("24H" | "2H")[] = [];
    if (msToStart > 0 && msToStart <= 24 * 60 * 60 * 1000 && !appt.remindersSent.includes("24H")) due.push("24H");
    if (msToStart > 0 && msToStart <= 2 * 60 * 60 * 1000 && !appt.remindersSent.includes("2H")) due.push("2H");
    if (due.length === 0) continue;

    const order = await Order.findById(appt.order).select("user orderNumber").lean();
    const user = order ? await User.findById(order.user).select("email").lean() : null;
    const store = await StoreLocation.findById(appt.storeLocation).select("name address").lean();

    for (const kind of due) {
      if (user && order && store) {
        const when = kind === "24H" ? "tomorrow" : "in 2 hours";
        const isReturn = appt.type === "RETURN";
        await sendEmail(
          user.email,
          `Your LuxeLoom ${isReturn ? "return drop-off" : "pickup"} is ${when} — ${order.orderNumber}`,
          [
            isReturn
              ? `Just a reminder to drop off your return — we'll take it from there.`
              : `We've set your pieces aside and can't wait to see you.`,
            ``,
            `Where: ${store.name}, ${store.address}`,
            `When: ${appt.date.toISOString().slice(0, 10)}, between ${appt.timeSlot}`,
            ``,
            isReturn
              ? `Just show the QR code from your order page and a photo ID at the counter. Running late? No worries — your slot stays reserved.`
              : `Just show the QR code from your order page and a photo ID at the counter. Running late? No worries — your order stays safely reserved for you.`,
          ].join("\n"),
          { heading: kind === "24H" ? "See you tomorrow" : "See you in a couple of hours" }
        );
      }
      appt.remindersSent.push(kind);
    }
    await appt.save();
  }
}

export function buildIcs(opts: {
  orderNumber: string;
  storeName: string;
  storeAddress: string;
  date: Date;
  timeSlot: string;
}): string {
  const start = slotStartDate(opts.date, opts.timeSlot);
  const end = slotEndDate(opts.date, opts.timeSlot);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LuxeLoom//Pickup//EN",
    "BEGIN:VEVENT",
    `UID:${opts.orderNumber}@luxeloom`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:LuxeLoom pickup — order ${opts.orderNumber}`,
    `LOCATION:${opts.storeName}, ${opts.storeAddress}`,
    "DESCRIPTION:Bring your pickup QR code and a photo ID.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
