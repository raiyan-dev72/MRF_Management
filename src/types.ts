export type AttendanceStatus = 'Present' | 'Absent' | 'Half Day';
export type StaffType = 'Old Staff' | 'New Staff';
export type PurchaseStatus = 'Pending' | 'Submitted To Accounts' | 'Approved' | 'Paid';
export type VehiclePurpose = 'Clearance' | 'Sales' | 'Material Delivery';
export type PaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Card';
export type DocumentCategory =
  | 'Bills'
  | 'Cash Vouchers'
  | 'DC Copies'
  | 'Purchase Invoices'
  | 'Petty Cash Bills'
  | 'Safety Dispatch Documents';

export interface Staff {
  id: string;
  name: string;
  type: StaffType;
  dailyRate: number;
  active: boolean;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  staffId: string;
  status: AttendanceStatus;
  dailyRate: number;
}

export interface WasteInwardRecord {
  id: string;
  date: string;
  siteName: string;
  dcNumber: string;
  materialName: string;
  quantity: number;
  vehicleNumber: string;
  driverName: string;
  dcCopy?: string;
}

export interface VehicleMovementRecord {
  id: string;
  date: string;
  driverName: string;
  vehicleNumber: string;
  tripNumber: string;
  fromLocation: string;
  toLocation: string;
  materialType: string;
  purpose: VehiclePurpose;
}

export interface SaleRecord {
  id: string;
  date: string;
  from: string;
  to: string;
  vendorName: string;
  material: string;
  grossQuantity: number;
  lessQuantity: number;
  finalQuantity: number;
  ratePerKg: number;
  gst: number;
  totalAmount: number;
  finalAmount: number;
}

export interface BaleStockRecord {
  id: string;
  material: string;
  produced: number;
  sold: number;
  threshold: number;
}

export interface SegregationRecord {
  id: string;
  date: string;
  material: string;
  balesProduced: number;
  labourCount: number;
}

export interface SafetyDispatchRecord {
  id: string;
  date: string;
  siteName: string;
  dcNumber: string;
  materialName: string;
  quantity: number;
  vehicle: string;
  driver: string;
}

export interface PurchaseRecord {
  id: string;
  date: string;
  category: string;
  vendor: string;
  siteName: string;
  description: string;
  amount: number;
  billUpload?: string;
  status: PurchaseStatus;
}

export interface PettyCashRecord {
  id: string;
  voucherNumber: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  billUpload?: string;
  paymentMode: PaymentMode;
}

export interface AccentureEntry {
  id: string;
  date: string;
  siteName: string;
  material: string;
  quantity: number;
}

export interface DocumentRecord {
  id: string;
  date: string;
  name: string;
  category: DocumentCategory;
  year: string;
  month: string;
  sourceModule: string;
  linkedRecord: string;
  url?: string;
}

export interface DriverRecord {
  id: string;
  name: string;
  active: boolean;
}

export interface VehicleRecord {
  id: string;
  vehicleNumber: string;
  active: boolean;
}

export interface AppState {
  staff: Staff[];
  attendance: AttendanceRecord[];
  wasteInward: WasteInwardRecord[];
  vehicleMovements: VehicleMovementRecord[];
  sales: SaleRecord[];
  baleStock: BaleStockRecord[];
  segregation: SegregationRecord[];
  safetyDispatch: SafetyDispatchRecord[];
  purchases: PurchaseRecord[];
  pettyCash: PettyCashRecord[];
  accenture: AccentureEntry[];
  documents: DocumentRecord[];
  drivers: DriverRecord[];
  vehicles: VehicleRecord[];
  pettyCashOpeningBalance: number;
}

export interface AuditIssue {
  id: string;
  severity: 'High' | 'Medium' | 'Low';
  title: string;
  detail: string;
  module: string;
}
