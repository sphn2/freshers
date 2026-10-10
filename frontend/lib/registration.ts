import type { Event } from "@/lib/types";

export interface RegistrationAvailability {
  open: boolean;
  isUpcoming?: boolean;
  label: string;
  explanation: string;
  exactOpenString?: string;
  openDateFormatted?: string;
  openTimeFormatted?: string;
}

export function registrationAvailability(event: Event, now = new Date()): RegistrationAvailability {
  if (!["PUBLISHED", "LIVE"].includes(event.status)) {
    return {
      open: false,
      label: event.status === "REGISTRATION_CLOSED" ? "Registration closed" : "Not accepting registrations",
      explanation: "This event is not currently accepting registrations.",
    };
  }
  if (event.registration_open === false) {
    return {
      open: false,
      label: "Closed by organizer",
      explanation: "The organizer has temporarily closed registrations.",
    };
  }
  if (event.registration_open !== true) {
    const start = Date.parse(event.registration_start);
    const end = Date.parse(event.registration_end);
    if (Number.isFinite(start) && now.getTime() < start) {
      const startDate = new Date(start);
      const openDateFormatted = startDate.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const openTimeFormatted = startDate.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const exactOpenString = `${openDateFormatted} at ${openTimeFormatted}`;

      return {
        open: false,
        isUpcoming: true,
        label: "Registration Opens Soon",
        explanation: `Registration for this event will officially open on ${exactOpenString}.`,
        exactOpenString,
        openDateFormatted,
        openTimeFormatted,
      };
    }
    if (Number.isFinite(end) && now.getTime() > end) {
      return {
        open: false,
        label: "Registration closed",
        explanation: "The scheduled registration window has ended.",
      };
    }
  }
  return {
    open: true,
    label: "Registration open",
    explanation: "Your place is one form away.",
  };
}
