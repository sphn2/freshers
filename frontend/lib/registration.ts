import type { Event } from "@/lib/types";

export interface RegistrationAvailability {
  open: boolean;
  label: string;
  explanation: string;
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
      return {
        open: false,
        label: "Opens soon",
        explanation: `Registration opens ${new Date(start).toLocaleString()}.`,
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
