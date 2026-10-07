export type EventStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "REGISTRATION_CLOSED"
  | "LIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  event_type: string;
  logo_url: string | null;
  banner_url: string | null;
  venue: string;
  start_time: string;
  end_time: string;
  registration_start: string;
  registration_end: string;
  capacity: number;
  ticket_price: number;
  first_year_ticket_price: number;
  second_year_ticket_price: number;
  other_ticket_price: number | null;
  allow_online: boolean;
  allow_offline: boolean;
  allow_autofill: boolean;
  registration_open: boolean | null;
  gate_validation_enabled: boolean;
  food_validation_enabled: boolean;
  status: EventStatus;
}

export interface RegistrationInput {
  full_name: string;
  roll_number: string;
  email: string;
  phone: string;
  department: string;
  college?: string;
}

export interface Registration {
  id: string;
  ticket_id?: string | null;
  event_id: string;
  full_name: string;
  roll_number: string;
  email: string;
  phone: string;
  department: string;
  college: string;
  ticket_price: number;
  status: string;
  payment_method: string;
  created_at: string;
}

export interface RegistrationResponse {
  message: string;
  registration: Registration;
  payment_token: string | null;
  existing_pending: boolean;
  payment_link_sent: boolean;
}

export interface StudentDirectoryRecord extends RegistrationInput {
  college: string;
}

export interface PaymentOrder {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  registration_id: string;
  already_paid?: boolean;
  ticket_id?: string | null;
}

export interface PaymentVerification {
  status: "PAID";
  registration_id: string;
  ticket_id: string;
  ticket_code: string;
}

export interface Ticket {
  id: string;
  event_id: string;
  registration_id: string;
  ticket_code: string;
  qr_token: string;
  status: string;
  gate_validated_at: string | null;
  student_name: string;
  roll_number: string;
  email: string;
  department: string;
  college: string;
  event_title: string;
  venue: string;
  start_time: string;
  food_status: string | null;
  food_validated_at: string | null;
}

export interface ValidationResult {
  status: "VALID" | "ALREADY_USED" | "FOOD_ALREADY_CLAIMED" | "INVALID_TICKET";
  message?: string;
  student_name?: string;
  roll_number?: string;
  department?: string;
  ticket_code?: string;
  gate_location?: string;
  food_location?: string;
  validated_at?: string | null;
}

export interface OfflineRegistrationInput extends RegistrationInput {
  event_id: string;
  amount_collected: number;
  receipt_number?: string;
}

export interface OfflineRegistrationResult {
  registration_id: string;
  ticket_id: string;
  ticket_code: string;
  student_name: string;
  amount_paid: number;
  collector_id: string;
  created_at: string;
}

export interface CollectorSummary {
  collector_id: string;
  total_count: number;
  total_cash: number;
  collections: Array<Record<string, unknown>>;
}

export interface DashboardMetrics {
  total_registrations: number;
  total_paid: number;
  total_pending: number;
  total_offline: number;
  total_revenue: number;
  online_revenue: number;
  offline_revenue: number;
  total_tickets: number;
  gate_validated_count: number;
  unvalidated_count: number;
  food_claimed_count: number;
  food_remaining_count: number;
}

export type ReportRow = Record<string, string | number | boolean | null | undefined>;

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface EventCreateInput {
  title: string;
  slug: string;
  description: string;
  event_type: string;
  venue: string;
  start_time: string;
  end_time: string;
  registration_start: string;
  registration_end: string;
  capacity: number;
  ticket_price: number;
  first_year_ticket_price: number;
  second_year_ticket_price: number;
  other_ticket_price?: number | null;
  allow_online: boolean;
  allow_offline: boolean;
  registration_open?: boolean | null;
  gate_validation_enabled: boolean;
  food_validation_enabled: boolean;
  status: EventStatus;
}

export type EventUpdateInput = Partial<EventCreateInput>;

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
