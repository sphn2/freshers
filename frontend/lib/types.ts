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
  payment_gateway?: "DEFAULT" | "RAZORPAY" | "CASHFREE" | "PHONEPE" | string;
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

export interface StudentDirectoryEntry {
  id: string;
  roll_number: string;
  full_name: string;
  department: string;
  college_name?: string;
  phone?: string | null;
  email?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DirectoryUploadResponse {
  message: string;
  total_processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface DirectoryListResponse {
  students: StudentDirectoryEntry[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface DirectoryStatsResponse {
  total_students: number;
  departments: Array<{ department: string; count: number }>;
}

export interface AutoFillResult {
  autofill_enabled: boolean;
  found: boolean;
  roll_number?: string;
  full_name?: string;
  department?: string;
  college?: string;
  phone?: string | null;
  email?: string | null;
  error?: string;
  message?: string;
}

export interface PaymentOrder {
  gateway?: "RAZORPAY" | "CASHFREE" | "PHONEPE" | string;
  order_id: string;
  amount: number;
  ticket_price?: number;
  convenience_fee?: number;
  convenience_fee_enabled?: boolean;
  currency: string;
  key_id?: string;
  payment_session_id?: string;
  redirect_url?: string;
  environment?: string;
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

export interface PaymentGatewayItem {
  name: string;
  enabled: boolean;
  configured: boolean;
  env?: string;
}

export interface PaymentGatewaySettings {
  default_gateway: "RAZORPAY" | "CASHFREE" | "PHONEPE" | string;
  gateways: Record<string, PaymentGatewayItem>;
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
  issued_by?: string | null;
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
  amount_paid: number;
  pin: string;
  receipt_number?: string;
}

export interface StaffAccount {
  id: string;
  full_name: string;
  email: string;
  role: string;
  roles?: string[];
  has_pin: boolean;
  created_at: string;
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
  allow_autofill?: boolean;
  registration_open?: boolean | null;
  gate_validation_enabled: boolean;
  food_validation_enabled: boolean;
  payment_gateway?: string;
  status: EventStatus;
}

export type EventUpdateInput = Partial<EventCreateInput>;

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ─── Financial Reporting & Settlement Types ───────────────────────────────────

export interface DailyRevenueRow {
  date: string;
  channel: "ONLINE" | "CASH";
  tickets_issued: number;
  amount: number;
  cumulative_tickets: number;
  cumulative_amount: number;
}

export interface DailyRevenueTotals {
  total_online_tickets: number;
  total_online_amount: number;
  total_cash_tickets: number;
  total_cash_amount: number;
  total_tickets: number;
  total_amount: number;
}

export interface DailyRevenueReport {
  online: DailyRevenueRow[];
  cash: DailyRevenueRow[];
  totals: DailyRevenueTotals;
}

export interface CollectorDailyRow {
  date: string;
  collector_id: string;
  collector_name: string;
  collector_email: string;
  tickets_count: number;
  total_cash: number;
}

export interface Settlement {
  id: string;
  event_id: string | null;
  event_title?: string | null;
  settlement_date: string;
  total_online_amount: number;
  total_cash_amount: number;
  total_tickets_issued: number;
  total_amount: number;
  is_settled: boolean;
  settled_at: string | null;
  settled_by: string | null;
  settler_name?: string | null;
  settler_email?: string | null;
  receiver_name: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  transaction_id: string | null;
  transaction_date: string | null;
  notes: string | null;
  authorized_by_name: string | null;
  receipt_number: string | null;
  created_at: string;
  updated_at?: string | null;
}
