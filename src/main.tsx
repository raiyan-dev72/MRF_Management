import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarCheck,
  ClipboardList,
  Database,
  FileArchive,
  FileCheck2,
  FileDown,
  FileText,
  Gauge,
  IndianRupee,
  LogOut,
  Menu,
  PackageCheck,
  ReceiptText,
  Recycle,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  UploadCloud,
  Users,
  WalletCards,
  Eye,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './styles.css';
import { drivers, materials, seedState, sites, today } from './data/seed';
import { emptyState, loadAppState, persistStateChanges } from './lib/database';
import { exportToExcel, exportToPdf } from './lib/exporters';
import { createId } from './lib/storage';
import { isSupabaseConfigured, signInWithPassword, supabase, uploadDocument } from './lib/supabase';
import {
  AccentureEntry,
  AppState,
  AttendanceRecord,
  AttendanceStatus,
  AuditIssue,
  BaleStockRecord,
  DocumentCategory,
  DocumentRecord,
  PettyCashRecord,
  PurchaseRecord,
  SafetyDispatchRecord,
  SaleRecord,
  SegregationRecord,
  Staff,
  StaffType,
  VehicleMovementRecord,
  WasteInwardRecord,
} from './types';

type ModuleKey =
  | 'dashboard'
  | 'attendance'
  | 'waste'
  | 'vehicles'
  | 'sales'
  | 'stock'
  | 'segregation'
  | 'safety'
  | 'purchase'
  | 'pettyCash'
  | 'accenture'
  | 'aiReport'
  | 'aiAuditor'
  | 'documents';

type FieldType = 'text' | 'number' | 'date' | 'select' | 'file';
type FormValue = string | number | File | null;
type FormRecord = Record<string, FormValue>;

interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
}

interface GenericModuleProps<T extends { id: string }> {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  rows: T[];
  fields: FieldConfig[];
  columns: { key: keyof T | string; label: string; render?: (row: T) => React.ReactNode }[];
  onAdd: (record: FormRecord) => void | Promise<void>;
  onUpdate?: (id: string, record: FormRecord) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  reportCards: { label: string; value: string; detail?: string }[];
  exportName: string;
}

const moduleItems: { key: ModuleKey; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <Gauge size={19} /> },
  { key: 'attendance', label: 'Staff Attendance', icon: <CalendarCheck size={19} /> },
  { key: 'waste', label: 'Waste Inward', icon: <Recycle size={19} /> },
  { key: 'vehicles', label: 'Vehicle Movement', icon: <Truck size={19} /> },
  { key: 'sales', label: 'Sales Management', icon: <IndianRupee size={19} /> },
  { key: 'stock', label: 'Bale Stock', icon: <Boxes size={19} /> },
  { key: 'segregation', label: 'Daily Segregation', icon: <PackageCheck size={19} /> },
  { key: 'safety', label: 'Safety Dispatch', icon: <ShieldCheck size={19} /> },
  { key: 'purchase', label: 'Purchase', icon: <ShoppingCart size={19} /> },
  { key: 'pettyCash', label: 'Petty Cash', icon: <WalletCards size={19} /> },
  { key: 'accenture', label: 'Accenture Entry', icon: <Database size={19} /> },
  { key: 'aiReport', label: 'AI Report', icon: <Sparkles size={19} /> },
  { key: 'aiAuditor', label: 'AI Auditor', icon: <AlertTriangle size={19} /> },
  { key: 'documents', label: 'Documents', icon: <FileArchive size={19} /> },
];

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

function sum<T>(rows: T[], selector: (row: T) => number) {
  return rows.reduce((total, row) => total + selector(row), 0);
}

function monthOf(date: string) {
  return date.slice(0, 7);
}

function groupSum<T>(rows: T[], label: (row: T) => string, value: (row: T) => number) {
  const map = new Map<string, number>();
  rows.forEach((row) => map.set(label(row), (map.get(label(row)) ?? 0) + value(row)));
  return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
}

function valueFor(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (typeof value === 'number') return number.format(value);
  return String(value ?? '');
}

function asRows<T extends Record<string, unknown>>(rows: T[]) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).filter(([key]) => key !== 'id').map(([key, value]) => [key, String(value ?? '')]),
    ),
  );
}

function statusUnits(status: AttendanceStatus) {
  if (status === 'Present') return 1;
  if (status === 'Half Day') return 0.5;
  return 0;
}

function createDocument(
  category: DocumentCategory,
  sourceModule: string,
  linkedRecord: string,
  name: string,
  url?: string,
): DocumentRecord {
  return {
    id: createId('doc'),
    date: today,
    name,
    category,
    year: today.slice(0, 4),
    month: today.slice(5, 7),
    sourceModule,
    linkedRecord,
    url,
  };
}

function formText(record: FormRecord, key: string) {
  const value = record[key];
  if (value instanceof File) return value.name;
  return String(value ?? '');
}

function formNumber(record: FormRecord, key: string) {
  return Number(record[key] ?? 0);
}

async function uploadFormFile(record: FormRecord, key: string, category: DocumentCategory) {
  const value = record[key];
  if (!(value instanceof File)) return formText(record, key);

  const result = await uploadDocument(value, `${today.slice(0, 4)}/${today.slice(5, 7)}/${category}`);
  if (result.error) throw new Error(result.error.message);
  return result.path;
}

function updateList<T extends { id: string }>(rows: T[], id: string, patch: Partial<T>) {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

function deleteFromList<T extends { id: string }>(rows: T[], id: string) {
  return rows.filter((row) => row.id !== id);
}

const DEMO_USER_EMAIL = 'demo@earthrecycler.local';

function Login({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [message, setMessage] = React.useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;

    const result = await signInWithPassword(email.trim(), password);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage('');
    onLogin(result.data?.user?.email ?? email.trim());
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="brand-mark">
          <Recycle size={36} />
        </div>
        <p className="eyebrow">Earth Recycler</p>
        <h1>MRF Management System</h1>
        <p>
          Digital attendance, DC entries, vehicle movement, sales, bale stock, purchases,
          petty cash, documents, reports, and audit checks in one simple cloud-ready system.
        </p>
        <div className="login-points">
          <span>Supabase email login</span>
          <span>Cloud document storage</span>
          <span>Excel and PDF exports</span>
        </div>
      </section>

      <form className="login-card" onSubmit={submit}>
        <h2>Supervisor Login</h2>
        <p>Enter your email address and password to continue.</p>
        <label>
          Email address
          <input
            type="email"
            value={email}
            placeholder="supervisor@earthrecycler.in"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            placeholder="Enter your password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="primary-button" type="submit">
          Sign In
        </button>
        {!isSupabaseConfigured && (
          <>
            <p className="helper-text">
              Supabase is required for production data. Add keys in `.env` to enable login.
            </p>
            <button
              className="ghost-button full-width demo-login-button"
              type="button"
              onClick={() => onLogin(DEMO_USER_EMAIL)}
            >
              Continue in Demo Mode
            </button>
          </>
        )}
        {message && <p className="notice">{message}</p>}
      </form>
    </main>
  );
}

function Header({
  activeModule,
  userEmail,
  onLogout,
  onMenu,
}: {
  activeModule: ModuleKey;
  userEmail: string;
  onLogout: () => void;
  onMenu: () => void;
}) {
  const activeLabel = moduleItems.find((item) => item.key === activeModule)?.label ?? 'Dashboard';

  return (
    <header className="topbar">
      <button className="icon-button mobile-only" onClick={onMenu} aria-label="Open menu">
        <Menu size={22} />
      </button>
      <div>
        <p className="eyebrow">Earth Recycler MRF</p>
        <h1>{activeLabel}</h1>
      </div>
      <div className="topbar-actions">
        <span className="cloud-pill">{isSupabaseConfigured ? 'Cloud connected' : 'Demo data'}</span>
        <span className="user-email">{userEmail}</span>
        <button className="ghost-button" onClick={onLogout}>
          <LogOut size={17} />
          Logout
        </button>
      </div>
    </header>
  );
}

function Sidebar({
  activeModule,
  onSelect,
  open,
  onClose,
}: {
  activeModule: ModuleKey;
  onSelect: (module: ModuleKey) => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark small">
            <Recycle size={25} />
          </div>
          <div>
            <strong>Earth Recycler</strong>
            <span>MRF Control Room</span>
          </div>
          <button className="icon-button mobile-only" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <nav>
          {moduleItems.map((item) => (
            <button
              key={item.key}
              className={activeModule === item.key ? 'active' : ''}
              onClick={() => {
                onSelect(item.key);
                onClose();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      {open && <button className="scrim" onClick={onClose} aria-label="Close menu" />}
    </>
  );
}

function KpiCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="kpi-card">
      <div className="kpi-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ChartPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="chart-panel">
      <h3>{title}</h3>
      <div className="chart-wrap">{children}</div>
    </section>
  );
}

function Dashboard({ state }: { state: AppState }) {
  const todaysAttendance = state.attendance.filter((record) => record.date === today);
  const todaysWaste = state.wasteInward.filter((record) => record.date === today);
  const todaysTrips = state.vehicleMovements.filter((record) => record.date === today);
  const todaysSales = state.sales.filter((record) => record.date === today);
  const todaysExpenses = [
    ...state.purchases.filter((record) => record.date === today),
    ...state.pettyCash.filter((record) => record.date === today),
  ];
  const pettyBalance = state.pettyCashOpeningBalance - sum(state.pettyCash, (record) => record.amount);
  const baleBalance = sum(state.baleStock, (record) => record.produced - record.sold);

  const monthlyWaste = groupSum(state.wasteInward, (record) => monthOf(record.date), (record) => record.quantity);
  const monthlySales = groupSum(state.sales, (record) => monthOf(record.date), (record) => record.finalAmount);
  const monthlyExpenses = groupSum(
    [...state.purchases, ...state.pettyCash],
    (record) => monthOf(record.date),
    (record) => record.amount,
  );
  const attendanceTrend = groupSum(
    state.attendance,
    (record) => record.date.slice(5),
    (record) => statusUnits(record.status),
  );

  return (
    <div className="screen">
      <section className="kpi-grid">
        <KpiCard
          label="Today's Attendance"
          value={`${number.format(sum(todaysAttendance, (record) => statusUnits(record.status)))} present`}
          detail={`${todaysAttendance.length} entries marked`}
          icon={<Users size={22} />}
        />
        <KpiCard
          label="Today's Vehicle Trips"
          value={String(todaysTrips.length)}
          detail="Trips logged today"
          icon={<Truck size={22} />}
        />
        <KpiCard
          label="Today's Waste Received"
          value={`${number.format(sum(todaysWaste, (record) => record.quantity))} kg`}
          detail={`${todaysWaste.length} DC entries`}
          icon={<Recycle size={22} />}
        />
        <KpiCard
          label="Today's Sales"
          value={currency.format(sum(todaysSales, (record) => record.finalAmount))}
          detail={`${todaysSales.length} invoices`}
          icon={<IndianRupee size={22} />}
        />
        <KpiCard
          label="Today's Expenses"
          value={currency.format(sum(todaysExpenses, (record) => record.amount))}
          detail="Purchase plus petty cash"
          icon={<ReceiptText size={22} />}
        />
        <KpiCard
          label="Current Petty Cash"
          value={currency.format(pettyBalance)}
          detail="Remaining balance"
          icon={<WalletCards size={22} />}
        />
        <KpiCard
          label="Current Bale Stock"
          value={`${number.format(baleBalance)} bales`}
          detail="Produced minus sold"
          icon={<Boxes size={22} />}
        />
      </section>

      <section className="charts-grid">
        <ChartPanel title="Monthly Waste Received">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyWaste}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" name="Kg" fill="#179957" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Monthly Sales Revenue">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlySales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Area dataKey="total" name="Revenue" stroke="#0f7d43" fill="#9de6bc" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Monthly Expenses">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyExpenses}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" name="Expenses" fill="#ef8f35" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Attendance Trend">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={attendanceTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="total" name="Present units" stroke="#0f7d43" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>
    </div>
  );
}

function GenericModule<T extends { id: string }>({
  title,
  subtitle,
  icon,
  rows,
  fields,
  columns,
  onAdd,
  onUpdate,
  onDelete,
  reportCards,
  exportName,
}: GenericModuleProps<T>) {
  const createInitialForm = () => Object.fromEntries(
    fields.map((field) => [field.name, field.type === 'number' ? 0 : field.type === 'date' ? today : '']),
  ) as FormRecord;
  const [form, setForm] = React.useState<FormRecord>(createInitialForm);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [viewRow, setViewRow] = React.useState<T | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (editingId && onUpdate) {
      await onUpdate(editingId, form);
    } else {
      await onAdd(form);
    }
    setEditingId(null);
    setForm(createInitialForm());
  }

  function startEdit(row: T) {
    const rowRecord = row as Record<string, unknown>;
    setEditingId(row.id);
    setForm(
      Object.fromEntries(
        fields.map((field) => [
          field.name,
          field.type === 'file' ? '' : (rowRecord[field.name] as FormValue) ?? '',
        ]),
      ) as FormRecord,
    );
  }

  async function deleteRow(id: string) {
    if (!onDelete) return;
    const confirmed = window.confirm('Delete this record permanently?');
    if (!confirmed) return;
    await onDelete(id);
  }

  return (
    <div className="screen">
      <section className="module-hero">
        <div className="module-title">
          <div className="module-icon">{icon}</div>
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
        </div>
        <div className="export-buttons">
          <button className="ghost-button" onClick={() => exportToExcel(exportName, asRows(rows as Record<string, unknown>[]))}>
            <FileDown size={17} />
            Excel
          </button>
          <button className="ghost-button" onClick={() => exportToPdf(exportName, asRows(rows as Record<string, unknown>[]))}>
            <FileText size={17} />
            PDF
          </button>
        </div>
      </section>

      <section className="mini-grid">
        {reportCards.map((card) => (
          <article className="mini-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            {card.detail && <small>{card.detail}</small>}
          </article>
        ))}
      </section>

      <section className="entry-layout">
        <form className="entry-form" onSubmit={submit}>
          <h3>{editingId ? 'Edit Entry' : 'Add New Entry'}</h3>
          <div className="form-grid">
            {fields.map((field) => (
              <label key={field.name}>
                {field.label}
                {field.type === 'select' ? (
                  <select
                    value={String(form[field.name] ?? '')}
                    onChange={(event) => setForm({ ...form, [field.name]: event.target.value })}
                    required
                  >
                    <option value="">Select</option>
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'file' ? (
                  <input
                    type="file"
                    onChange={(event) =>
                      setForm({ ...form, [field.name]: event.target.files?.[0] ?? null })
                    }
                  />
                ) : (
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={String(form[field.name] ?? '')}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        [field.name]:
                          field.type === 'number' ? Number(event.target.value) : event.target.value,
                      })
                    }
                    required
                  />
                )}
              </label>
            ))}
          </div>
          <button className="primary-button" type="submit">
            {editingId ? 'Update Entry' : 'Save Entry'}
          </button>
          {editingId && (
            <button
              className="ghost-button full-width"
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(createInitialForm());
              }}
            >
              Cancel Edit
            </button>
          )}
        </form>

        <DataTable
          columns={columns}
          rows={rows}
          emptyText="No entries yet."
          onView={setViewRow}
          onEdit={onUpdate ? startEdit : undefined}
          onDelete={onDelete ? deleteRow : undefined}
        />
      </section>
      {viewRow && (
        <RecordModal
          title={title}
          columns={columns}
          row={viewRow}
          onClose={() => setViewRow(null)}
        />
      )}
    </div>
  );
}

function DataTable<T extends { id: string }>({
  columns,
  rows,
  emptyText,
  onView,
  onEdit,
  onDelete,
}: {
  columns: { key: keyof T | string; label: string; render?: (row: T) => React.ReactNode }[];
  rows: T[];
  emptyText: string;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (id: string) => void | Promise<void>;
}) {
  const hasActions = Boolean(onView || onEdit || onDelete);

  return (
    <div className="table-card">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={String(column.key)}>{column.label}</th>
              ))}
              {hasActions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (hasActions ? 1 : 0)} className="empty-cell">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((column) => (
                    <td key={String(column.key)}>
                      {column.render
                        ? column.render(row)
                        : valueFor(row as Record<string, unknown>, String(column.key))}
                    </td>
                  ))}
                  {hasActions && (
                    <td>
                      <div className="row-actions">
                        {onView && (
                          <button className="icon-action" onClick={() => onView(row)} title="View">
                            <Eye size={16} />
                          </button>
                        )}
                        {onEdit && (
                          <button className="icon-action" onClick={() => onEdit(row)} title="Edit">
                            <Pencil size={16} />
                          </button>
                        )}
                        {onDelete && (
                          <button className="icon-action danger" onClick={() => onDelete(row.id)} title="Delete">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecordModal<T extends { id: string }>({
  title,
  columns,
  row,
  onClose,
}: {
  title: string;
  columns: { key: keyof T | string; label: string; render?: (row: T) => React.ReactNode }[];
  row: T;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="record-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{title} Details</h3>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <dl className="detail-list">
          {columns.map((column) => (
            <div key={String(column.key)}>
              <dt>{column.label}</dt>
              <dd>
                {column.render
                  ? column.render(row)
                  : valueFor(row as Record<string, unknown>, String(column.key))}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function AttendanceModule({
  state,
  setState,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  const [staffName, setStaffName] = React.useState('');
  const [staffType, setStaffType] = React.useState<StaffType>('New Staff');
  const [staffEditId, setStaffEditId] = React.useState<string | null>(null);
  const [attendanceEditId, setAttendanceEditId] = React.useState<string | null>(null);
  const [bulkDate, setBulkDate] = React.useState(today);
  const [bulkStatus, setBulkStatus] = React.useState<AttendanceStatus>('Present');
  const [selectedStaffIds, setSelectedStaffIds] = React.useState<string[]>([]);
  const currentMonth = today.slice(0, 7);
  const activeStaff = state.staff.filter((staff) => staff.active || selectedStaffIds.includes(staff.id));

  function resetAttendanceForm() {
    setAttendanceEditId(null);
    setBulkDate(today);
    setBulkStatus('Present');
    setSelectedStaffIds([]);
  }

  function toggleStaffSelection(staffId: string) {
    if (attendanceEditId) {
      setSelectedStaffIds([staffId]);
      return;
    }

    setSelectedStaffIds((previous) =>
      previous.includes(staffId) ? previous.filter((id) => id !== staffId) : [...previous, staffId],
    );
  }

  function selectAllStaff() {
    if (attendanceEditId) return;
    setSelectedStaffIds(activeStaff.map((staff) => staff.id));
  }

  function addStaff(event: React.FormEvent) {
    event.preventDefault();
    const dailyRate = staffType === 'Old Staff' ? 650 : 600;
    setState((previous) => ({
      ...previous,
      staff: staffEditId
        ? updateList(previous.staff, staffEditId, { name: staffName, type: staffType, dailyRate })
        : [...previous.staff, { id: createId('staff'), name: staffName, type: staffType, dailyRate, active: true }],
    }));
    setStaffName('');
    setStaffEditId(null);
  }

  function markBulkAttendance(event: React.FormEvent) {
    event.preventDefault();
    if (selectedStaffIds.length === 0) return;

    setState((previous) => {
      let nextAttendance = [...previous.attendance];

      if (attendanceEditId) {
        const existing = nextAttendance.find((record) => record.id === attendanceEditId);
        const staffId = selectedStaffIds[0] ?? existing?.staffId;
        const staff = previous.staff.find((person) => person.id === staffId);
        if (!staff || !existing) return previous;

        nextAttendance = updateList(nextAttendance, attendanceEditId, {
          date: bulkDate,
          staffId,
          status: bulkStatus,
          dailyRate: staff.dailyRate,
        });
      } else {
        selectedStaffIds.forEach((staffId) => {
          const staff = previous.staff.find((person) => person.id === staffId);
          if (!staff) return;

          const existing = nextAttendance.find(
            (record) => record.staffId === staffId && record.date === bulkDate,
          );

          if (existing) {
            nextAttendance = updateList(nextAttendance, existing.id, {
              status: bulkStatus,
              dailyRate: staff.dailyRate,
            });
          } else {
            nextAttendance.push({
              id: createId('att'),
              date: bulkDate,
              staffId,
              status: bulkStatus,
              dailyRate: staff.dailyRate,
            });
          }
        });
      }

      return { ...previous, attendance: nextAttendance };
    });

    if (!attendanceEditId) {
      setSelectedStaffIds([]);
    } else {
      resetAttendanceForm();
    }
  }

  const salaryRows = state.staff.map((staff) => {
    const records = state.attendance.filter(
      (record) => record.staffId === staff.id && record.date.startsWith(currentMonth),
    );
    const presentUnits = sum(records, (record) => statusUnits(record.status));
    return {
      id: staff.id,
      name: staff.name,
      type: staff.type,
      dailyRate: staff.dailyRate,
      active: staff.active ? 'Active' : 'Inactive',
      presentUnits,
      salary: presentUnits * staff.dailyRate,
    };
  });

  const attendanceRows = state.attendance
    .slice()
    .reverse()
    .map((record) => ({
      ...record,
      staffName: state.staff.find((staff) => staff.id === record.staffId)?.name ?? 'Unknown',
    }));

  return (
    <div className="screen">
      <section className="module-hero">
        <div className="module-title">
          <div className="module-icon">
            <CalendarCheck size={24} />
          </div>
          <div>
            <h2>Staff Attendance</h2>
            <p>Add staff anytime, mark attendance, and generate monthly salary automatically.</p>
          </div>
        </div>
        <div className="export-buttons">
          <button className="ghost-button" onClick={() => exportToExcel('monthly-salary-report', salaryRows)}>
            <FileDown size={17} />
            Salary Excel
          </button>
          <button className="ghost-button" onClick={() => exportToPdf('Monthly Salary Report', salaryRows)}>
            <FileText size={17} />
            Salary PDF
          </button>
        </div>
      </section>

      <section className="mini-grid">
        <article className="mini-card">
          <span>Old Staff Rate</span>
          <strong>{currency.format(650)}</strong>
          <small>Per full day</small>
        </article>
        <article className="mini-card">
          <span>New Staff Rate</span>
          <strong>{currency.format(600)}</strong>
          <small>Per full day</small>
        </article>
        <article className="mini-card">
          <span>This Month Salary</span>
          <strong>{currency.format(sum(salaryRows, (row) => row.salary))}</strong>
          <small>{currentMonth}</small>
        </article>
      </section>

      <form className="entry-form" onSubmit={addStaff}>
          <h3>{staffEditId ? 'Edit Staff' : 'Add New Staff'}</h3>
          <label>
            Staff Name
            <input value={staffName} onChange={(event) => setStaffName(event.target.value)} required />
          </label>
          <label>
            Staff Type
            <select value={staffType} onChange={(event) => setStaffType(event.target.value as StaffType)}>
              <option>New Staff</option>
              <option>Old Staff</option>
            </select>
          </label>
          <button className="primary-button" type="submit">
            {staffEditId ? 'Update Staff' : 'Add Staff'}
          </button>
          {staffEditId && (
            <button
              className="ghost-button full-width"
              type="button"
              onClick={() => {
                setStaffEditId(null);
                setStaffName('');
                setStaffType('New Staff');
              }}
            >
              Cancel Edit
            </button>
          )}
        </form>

      <form className="entry-form bulk-attendance-form" onSubmit={markBulkAttendance}>
        <div className="bulk-attendance-header">
          <h3>{attendanceEditId ? 'Correct Attendance' : 'Bulk Mark Attendance'}</h3>
          <p>
            {attendanceEditId
              ? 'Update the selected record below.'
              : 'Select one or more staff members, choose a date and status, then save in one step.'}
          </p>
        </div>
        <div className="bulk-attendance-controls">
          <label>
            Date
            <input
              type="date"
              value={bulkDate}
              onChange={(event) => setBulkDate(event.target.value)}
            />
          </label>
          <label>
            Status
            <select
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value as AttendanceStatus)}
            >
              <option>Present</option>
              <option>Absent</option>
              <option>Half Day</option>
            </select>
          </label>
        </div>
        {!attendanceEditId && (
          <div className="bulk-attendance-toolbar">
            <span>{selectedStaffIds.length} of {activeStaff.length} selected</span>
            <div className="bulk-attendance-actions">
              <button className="ghost-button" type="button" onClick={selectAllStaff}>
                Select All
              </button>
              <button className="ghost-button" type="button" onClick={() => setSelectedStaffIds([])}>
                Clear
              </button>
            </div>
          </div>
        )}
        <div className="bulk-attendance-list">
          {activeStaff.length === 0 ? (
            <p className="helper-text">Add staff members before marking attendance.</p>
          ) : (
            activeStaff.map((staff) => {
              const existing = state.attendance.find(
                (record) => record.staffId === staff.id && record.date === bulkDate,
              );
              const checked = selectedStaffIds.includes(staff.id);

              return (
                <label
                  key={staff.id}
                  className={`bulk-attendance-item${checked ? ' selected' : ''}${existing ? ' marked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStaffSelection(staff.id)}
                  />
                  <span className="bulk-attendance-name">{staff.name}</span>
                  <span className="bulk-attendance-meta">{staff.type}</span>
                  {existing && <span className="status-pill">{existing.status}</span>}
                </label>
              );
            })
          )}
        </div>
        <button className="primary-button" type="submit" disabled={selectedStaffIds.length === 0}>
          {attendanceEditId
            ? 'Update Attendance'
            : `Save Attendance (${selectedStaffIds.length})`}
        </button>
        {attendanceEditId && (
          <button className="ghost-button full-width" type="button" onClick={resetAttendanceForm}>
            Cancel Correction
          </button>
        )}
      </form>

      <section className="entry-layout single">
        <DataTable
          rows={attendanceRows}
          emptyText="No attendance marked."
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'staffName', label: 'Staff Name' },
            { key: 'status', label: 'Status' },
            { key: 'dailyRate', label: 'Daily Rate', render: (row) => currency.format(row.dailyRate) },
          ]}
          onEdit={(row) => {
            setAttendanceEditId(row.id);
            setBulkDate(row.date);
            setBulkStatus(row.status);
            setSelectedStaffIds([row.staffId]);
          }}
          onDelete={(id) => {
            if (!window.confirm('Remove this attendance record permanently?')) return;
            setState((previous) => ({
              ...previous,
              attendance: deleteFromList(previous.attendance, id),
            }));
          }}
        />
        <DataTable
          rows={salaryRows}
          emptyText="No staff available."
          columns={[
            { key: 'name', label: 'Staff Name' },
            { key: 'type', label: 'Type' },
            { key: 'active', label: 'Status' },
            { key: 'dailyRate', label: 'Daily Rate', render: (row) => currency.format(row.dailyRate) },
            { key: 'presentUnits', label: 'Present Days' },
            { key: 'salary', label: 'Salary', render: (row) => currency.format(row.salary) },
          ]}
          onEdit={(row) => {
            const staff = state.staff.find((person) => person.id === row.id);
            if (!staff) return;
            setStaffEditId(staff.id);
            setStaffName(staff.name);
            setStaffType(staff.type);
          }}
          onDelete={(id) => {
            if (!window.confirm('Delete this staff member permanently?')) return;
            setState((previous) => ({
              ...previous,
              staff: deleteFromList(previous.staff, id),
              attendance: previous.attendance.filter((record) => record.staffId !== id),
            }));
          }}
          onView={(row) =>
            setState((previous) => ({
              ...previous,
              staff: updateList(previous.staff, row.id, {
                active: row.active !== 'Active',
              }),
            }))
          }
        />
      </section>
    </div>
  );
}

function BaleStockModule({
  state,
  setState,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  function save(record: FormRecord) {
    const material = formText(record, 'material');
    const produced = formNumber(record, 'produced');
    const sold = formNumber(record, 'sold');
    const threshold = formNumber(record, 'threshold');
    setState((previous) => {
      const existing = previous.baleStock.find((row) => row.material === material);
      if (existing) {
        return {
          ...previous,
          baleStock: previous.baleStock.map((row) =>
            row.id === existing.id
              ? {
                  ...row,
                  produced: row.produced + produced,
                  sold: row.sold + sold,
                  threshold,
                }
              : row,
          ),
        };
      }

      return {
        ...previous,
        baleStock: [...previous.baleStock, { id: createId('stock'), material, produced, sold, threshold }],
      };
    });
  }

  const rows = state.baleStock.map((row) => ({
    ...row,
    balance: row.produced - row.sold,
    alert: row.produced - row.sold > row.threshold ? 'High stock' : 'OK',
  }));

  return (
    <GenericModule
      title="Bale Stock Management"
      subtitle="Track produced, sold, and balance stock for every bale material."
      icon={<Boxes size={24} />}
      rows={rows}
      exportName="bale-stock-report"
      reportCards={[
        { label: 'Produced', value: `${number.format(sum(state.baleStock, (row) => row.produced))} bales` },
        { label: 'Sold', value: `${number.format(sum(state.baleStock, (row) => row.sold))} bales` },
        {
          label: 'Balance Stock',
          value: `${number.format(sum(state.baleStock, (row) => row.produced - row.sold))} bales`,
        },
      ]}
      fields={[
        { name: 'material', label: 'Material', type: 'select', options: materials },
        { name: 'produced', label: 'Produced', type: 'number' },
        { name: 'sold', label: 'Sold', type: 'number' },
        { name: 'threshold', label: 'Sale Threshold', type: 'number' },
      ]}
      columns={[
        { key: 'material', label: 'Material' },
        { key: 'produced', label: 'Produced' },
        { key: 'sold', label: 'Sold' },
        { key: 'balance', label: 'Balance Stock' },
        {
          key: 'alert',
          label: 'Alert',
          render: (row) => (
            <span className={row.alert === 'High stock' ? 'status warning' : 'status success'}>{row.alert}</span>
          ),
        },
      ]}
      onAdd={save}
      onUpdate={(id, record) =>
        setState((previous) => ({
          ...previous,
          baleStock: updateList(previous.baleStock, id, {
            material: formText(record, 'material'),
            produced: formNumber(record, 'produced'),
            sold: formNumber(record, 'sold'),
            threshold: formNumber(record, 'threshold'),
          }),
        }))
      }
      onDelete={(id) =>
        setState((previous) => ({
          ...previous,
          baleStock: deleteFromList(previous.baleStock, id),
        }))
      }
    />
  );
}

function PettyCashModule({
  state,
  setState,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  const currentBalance = state.pettyCashOpeningBalance - sum(state.pettyCash, (row) => row.amount);
  const pendingBills = state.purchases.filter((row) => row.status !== 'Paid');

  async function add(record: FormRecord) {
    const voucher = formText(record, 'voucherNumber');
    const billUpload = await uploadFormFile(record, 'billUpload', 'Petty Cash Bills');
    setState((previous) => ({
      ...previous,
      pettyCash: [
        ...previous.pettyCash,
        {
          id: createId('cash'),
          voucherNumber: voucher,
          date: formText(record, 'date'),
          category: formText(record, 'category'),
          description: formText(record, 'description'),
          amount: formNumber(record, 'amount'),
          billUpload,
          paymentMode: formText(record, 'paymentMode') as PettyCashRecord['paymentMode'],
        },
      ],
      documents: billUpload
        ? [
            ...previous.documents,
            createDocument('Petty Cash Bills', 'Petty Cash', voucher, `${voucher} Voucher`, billUpload),
          ]
        : previous.documents,
    }));
  }

  return (
    <GenericModule
      title="Petty Cash Management"
      subtitle="Track vouchers, expenses, pending bills, and remaining cash balance."
      icon={<WalletCards size={24} />}
      rows={state.pettyCash}
      exportName="petty-cash-report"
      reportCards={[
        { label: 'Opening Balance', value: currency.format(state.pettyCashOpeningBalance) },
        { label: 'Expenses', value: currency.format(sum(state.pettyCash, (row) => row.amount)) },
        { label: 'Current Balance', value: currency.format(currentBalance) },
        { label: 'Pending Bill Amount', value: currency.format(sum(pendingBills, (row) => row.amount)) },
      ]}
      fields={[
        { name: 'voucherNumber', label: 'Voucher Number', type: 'text' },
        { name: 'date', label: 'Date', type: 'date' },
        { name: 'category', label: 'Category', type: 'text' },
        { name: 'description', label: 'Description', type: 'text' },
        { name: 'amount', label: 'Amount', type: 'number' },
        { name: 'billUpload', label: 'Bill Upload', type: 'file' },
        { name: 'paymentMode', label: 'Payment Mode', type: 'select', options: ['Cash', 'UPI', 'Bank Transfer', 'Card'] },
      ]}
      columns={[
        { key: 'voucherNumber', label: 'Voucher' },
        { key: 'date', label: 'Date' },
        { key: 'category', label: 'Category' },
        { key: 'description', label: 'Description' },
        { key: 'amount', label: 'Amount', render: (row) => currency.format(row.amount) },
        { key: 'paymentMode', label: 'Payment Mode' },
        {
          key: 'billUpload',
          label: 'Bill',
          render: (row) => (row.billUpload ? <a className="text-link" href={row.billUpload} target="_blank">View Bill</a> : <span className="status warning">Missing</span>),
        },
      ]}
      onAdd={add}
      onUpdate={async (id, record) => {
        const existing = state.pettyCash.find((row) => row.id === id);
        const billUpload = record.billUpload instanceof File
          ? await uploadFormFile(record, 'billUpload', 'Petty Cash Bills')
          : existing?.billUpload ?? '';
        setState((previous) => ({
          ...previous,
          pettyCash: updateList(previous.pettyCash, id, {
            voucherNumber: formText(record, 'voucherNumber'),
            date: formText(record, 'date'),
            category: formText(record, 'category'),
            description: formText(record, 'description'),
            amount: formNumber(record, 'amount'),
            billUpload,
            paymentMode: formText(record, 'paymentMode') as PettyCashRecord['paymentMode'],
          }),
        }));
      }}
      onDelete={(id) =>
        setState((previous) => ({
          ...previous,
          pettyCash: deleteFromList(previous.pettyCash, id),
        }))
      }
    />
  );
}

function AiReportModule({ state }: { state: AppState }) {
  const [report, setReport] = React.useState('');

  function generate() {
    const attendance = state.attendance.filter((row) => row.date === today);
    const trips = state.vehicleMovements.filter((row) => row.date === today);
    const segregation = state.segregation.filter((row) => row.date === today);
    const pettyToday = state.pettyCash.filter((row) => row.date === today);
    const purchasesToday = state.purchases.filter((row) => row.date === today);
    const balance = state.pettyCashOpeningBalance - sum(state.pettyCash, (row) => row.amount);

    const lines = [
      'Daily MRF Report',
      `Date: ${today}`,
      '',
      '1. Staff Attendance',
      `Present units: ${number.format(sum(attendance, (row) => statusUnits(row.status)))}`,
      `Absent: ${attendance.filter((row) => row.status === 'Absent').length}`,
      '',
      '2. Vehicle Movement',
      ...trips.map((row) => `${row.vehicleNumber} - Trip ${row.tripNumber} - ${row.purpose} - ${row.fromLocation} to ${row.toLocation}`),
      trips.length ? '' : 'No trips recorded.',
      '',
      '3. Segregation Details',
      ...segregation.map((row) => `${row.material}: ${row.balesProduced} bales with ${row.labourCount} labour`),
      segregation.length ? '' : 'No segregation recorded.',
      '',
      '4. Labour Working Details',
      `Total labour used in segregation: ${sum(segregation, (row) => row.labourCount)}`,
      '',
      '5. Expenses Details',
      `Petty cash expenses: ${currency.format(sum(pettyToday, (row) => row.amount))}`,
      `Purchase expenses: ${currency.format(sum(purchasesToday, (row) => row.amount))}`,
      '',
      '6. Balance Amount',
      `Current petty cash balance: ${currency.format(balance)}`,
    ];

    setReport(lines.join('\n'));
  }

  return (
    <div className="screen">
      <section className="module-hero">
        <div className="module-title">
          <div className="module-icon">
            <Sparkles size={24} />
          </div>
          <div>
            <h2>AI Report Generator</h2>
            <p>Generate the daily supervisor report in the required approval format.</p>
          </div>
        </div>
        <div className="export-buttons">
          <button className="primary-button" onClick={generate}>
            Generate Daily Report
          </button>
          <button
            className="ghost-button"
            onClick={() => exportToPdf('Daily MRF Report', report.split('\n').map((line, index) => ({ line: index + 1, details: line })))}
            disabled={!report}
          >
            <FileText size={17} />
            Export PDF
          </button>
        </div>
      </section>
      <section className="report-paper">
        {report ? <pre>{report}</pre> : <p>Click Generate Daily Report to prepare today's report.</p>}
      </section>
    </div>
  );
}

function collectAuditIssues(state: AppState): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const presentByDate = new Map<string, number>();
  state.attendance.forEach((row) => {
    presentByDate.set(row.date, (presentByDate.get(row.date) ?? 0) + statusUnits(row.status));
  });

  state.segregation.forEach((row) => {
    const present = presentByDate.get(row.date) ?? 0;
    if (row.labourCount > present) {
      issues.push({
        id: `labour-${row.id}`,
        severity: 'High',
        module: 'Daily Segregation',
        title: 'Labour mismatch',
        detail: `${row.date}: ${row.labourCount} labour used but only ${present} attendance units marked.`,
      });
    }
  });

  state.wasteInward
    .filter((row) => !row.dcCopy)
    .forEach((row) =>
      issues.push({
        id: `dc-${row.id}`,
        severity: 'Medium',
        module: 'Waste Inward',
        title: 'Missing DC copy',
        detail: `${row.dcNumber} from ${row.siteName} has no uploaded DC copy.`,
      }),
    );

  state.purchases
    .filter((row) => !row.billUpload)
    .forEach((row) =>
      issues.push({
        id: `bill-${row.id}`,
        severity: 'Medium',
        module: 'Purchase',
        title: 'Missing bill',
        detail: `${row.vendor} bill for ${currency.format(row.amount)} is not uploaded.`,
      }),
    );

  state.pettyCash
    .filter((row) => !row.billUpload)
    .forEach((row) =>
      issues.push({
        id: `voucher-${row.id}`,
        severity: 'Low',
        module: 'Petty Cash',
        title: 'Missing voucher bill',
        detail: `${row.voucherNumber} does not have a bill or voucher copy.`,
      }),
    );

  const tripKeys = new Set<string>();
  state.vehicleMovements.forEach((row) => {
    if (!row.driverName || !row.vehicleNumber || !row.fromLocation || !row.toLocation) {
      issues.push({
        id: `vehicle-${row.id}`,
        severity: 'High',
        module: 'Vehicle Movement',
        title: 'Missing vehicle details',
        detail: `${row.date} trip ${row.tripNumber} has incomplete vehicle movement details.`,
      });
    }
    const key = `${row.date}-${row.vehicleNumber}-${row.tripNumber}`;
    if (tripKeys.has(key)) {
      issues.push({
        id: `duplicate-${row.id}`,
        severity: 'High',
        module: 'Vehicle Movement',
        title: 'Duplicate trip',
        detail: `${row.vehicleNumber} trip ${row.tripNumber} appears more than once on ${row.date}.`,
      });
    }
    tripKeys.add(key);
  });

  state.baleStock.forEach((row) => {
    if (row.sold > row.produced) {
      issues.push({
        id: `stock-${row.id}`,
        severity: 'High',
        module: 'Bale Stock',
        title: 'Stock mismatch',
        detail: `${row.material} sold bales are higher than produced bales.`,
      });
    }
  });

  state.sales.forEach((row) => {
    const finalQuantity = row.grossQuantity - row.lessQuantity;
    const totalAmount = finalQuantity * row.ratePerKg;
    const finalAmount = totalAmount * (1 + row.gst / 100);
    if (
      Math.abs(row.finalQuantity - finalQuantity) > 0.01 ||
      Math.abs(row.totalAmount - totalAmount) > 0.01 ||
      Math.abs(row.finalAmount - finalAmount) > 0.01
    ) {
      issues.push({
        id: `sale-${row.id}`,
        severity: 'High',
        module: 'Sales',
        title: 'Sales mismatch',
        detail: `${row.vendorName} ${row.material} sale total does not match quantity, rate, and GST.`,
      });
    }
  });

  const pettyBalance = state.pettyCashOpeningBalance - sum(state.pettyCash, (row) => row.amount);
  if (pettyBalance < 0) {
    issues.push({
      id: 'petty-negative',
      severity: 'High',
      module: 'Petty Cash',
      title: 'Balance calculation error',
      detail: 'Petty cash expenses are higher than the opening balance.',
    });
  }

  return issues;
}

function AiAuditorModule({ state }: { state: AppState }) {
  const [issues, setIssues] = React.useState<AuditIssue[]>([]);

  return (
    <div className="screen">
      <section className="module-hero">
        <div className="module-title">
          <div className="module-icon">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h2>AI Auditor</h2>
            <p>Check errors before report approval: mismatches, missing documents, duplicates, and cash issues.</p>
          </div>
        </div>
        <button className="primary-button" onClick={() => setIssues(collectAuditIssues(state))}>
          Check Errors
        </button>
      </section>

      <section className="audit-list">
        {issues.length === 0 ? (
          <div className="success-panel">
            <FileCheck2 size={28} />
            <h3>No warnings shown yet</h3>
            <p>Click Check Errors to scan attendance, labour, DC copies, bills, trips, stock, sales, and petty cash.</p>
          </div>
        ) : (
          issues.map((issue) => (
            <article className="audit-card" key={issue.id}>
              <span className={`severity ${issue.severity.toLowerCase()}`}>{issue.severity}</span>
              <div>
                <h3>{issue.title}</h3>
                <p>{issue.detail}</p>
                <small>{issue.module}</small>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function DocumentStorageModule({
  state,
  setState,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  const [query, setQuery] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [category, setCategory] = React.useState<DocumentCategory>('Bills');
  const filtered = state.documents.filter((document) =>
    `${document.name} ${document.category} ${document.sourceModule} ${document.linkedRecord}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const folderPath = `${today.slice(0, 4)}/${today.slice(5, 7)}/${category}`;
    const result = await uploadDocument(file, folderPath);
    setUploading(false);

    if (!result.error) {
      setState((previous) => ({
        ...previous,
        documents: [
          ...previous.documents,
          createDocument(category, 'Document Storage', file.name, file.name, result.path),
        ],
      }));
    }
  }

  async function replaceDocument(document: DocumentRecord, file?: File) {
    if (!file) return;

    const result = await uploadDocument(file, `${document.year}/${document.month}/${document.category}`);
    if (result.error) return;

    setState((previous) => ({
      ...previous,
      documents: updateList(previous.documents, document.id, {
        name: file.name,
        url: result.path,
      }),
    }));
  }

  function deleteDocument(id: string) {
    if (!window.confirm('Delete this document record permanently?')) return;
    setState((previous) => ({
      ...previous,
      documents: deleteFromList(previous.documents, id),
    }));
  }

  return (
    <div className="screen">
      <section className="module-hero">
        <div className="module-title">
          <div className="module-icon">
            <FileArchive size={24} />
          </div>
          <div>
            <h2>Document Storage</h2>
            <p>Store bills, vouchers, DC copies, and purchase invoices in Year / Month / Category folders.</p>
          </div>
        </div>
      </section>

      <section className="document-toolbar">
        <label className="search-box">
          <Search size={18} />
          <input
            value={query}
            placeholder="Search documents instantly"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value as DocumentCategory)}>
            <option>Bills</option>
            <option>Cash Vouchers</option>
            <option>DC Copies</option>
            <option>Purchase Invoices</option>
            <option>Petty Cash Bills</option>
            <option>Safety Dispatch Documents</option>
          </select>
        </label>
        <label className="upload-drop">
          <UploadCloud size={20} />
          {uploading ? 'Uploading...' : 'Upload Document'}
          <input type="file" onChange={handleUpload} />
        </label>
      </section>

      <section className="document-grid">
        {filtered.map((document) => (
          <article className="document-card" key={document.id}>
            <FileText size={24} />
            <div>
              <strong>{document.name}</strong>
              <span>{document.year} / {document.month} / {document.category}</span>
              <small>{document.sourceModule} - {document.linkedRecord}</small>
              <div className="document-actions">
                {document.url && (
                  <>
                    <a className="ghost-link" href={document.url} target="_blank">View</a>
                    <a className="ghost-link" href={document.url} download>Download</a>
                  </>
                )}
                <label className="ghost-link replace-link">
                  Replace
                  <input type="file" onChange={(event) => replaceDocument(document, event.target.files?.[0])} />
                </label>
                <button className="ghost-link danger" onClick={() => deleteDocument(document.id)}>Delete</button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function buildModule(
  activeModule: ModuleKey,
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
) {
  const driverOptions = state.drivers.filter((driver) => driver.active).map((driver) => driver.name);
  const vehicleOptions = state.vehicles.filter((vehicle) => vehicle.active).map((vehicle) => vehicle.vehicleNumber);
  const availableDrivers = driverOptions.length ? driverOptions : drivers;
  const availableVehicles = vehicleOptions.length ? vehicleOptions : ['KA-03-MQ-7781', 'KA-05-AB-1201', 'KA-04-MR-3218'];
  const addDocumentIfUploaded = (
    previous: AppState,
    upload: string | number,
    category: DocumentCategory,
    sourceModule: string,
    linkedRecord: string,
  ) => {
    if (!upload) return previous.documents;
    return [
      ...previous.documents,
      createDocument(category, sourceModule, linkedRecord, `${linkedRecord} ${category}`, String(upload)),
    ];
  };

  switch (activeModule) {
    case 'dashboard':
      return <Dashboard state={state} />;
    case 'attendance':
      return <AttendanceModule state={state} setState={setState} />;
    case 'waste':
      return (
        <GenericModule<WasteInwardRecord>
          title="Waste Inward (DC Entry)"
          subtitle="Record site-wise and material-wise waste received with vehicle and DC copy details."
          icon={<Recycle size={24} />}
          rows={state.wasteInward}
          exportName="waste-inward-report"
          reportCards={[
            { label: 'Today Waste', value: `${number.format(sum(state.wasteInward.filter((row) => row.date === today), (row) => row.quantity))} kg` },
            { label: 'Sites Covered', value: String(new Set(state.wasteInward.map((row) => row.siteName)).size) },
            { label: 'Material Types', value: String(new Set(state.wasteInward.map((row) => row.materialName)).size) },
          ]}
          fields={[
            { name: 'date', label: 'Date', type: 'date' },
            { name: 'siteName', label: 'Site Name', type: 'select', options: sites },
            { name: 'dcNumber', label: 'DC Number', type: 'text' },
            { name: 'materialName', label: 'Material Name', type: 'select', options: materials },
            { name: 'quantity', label: 'Quantity', type: 'number' },
            { name: 'vehicleNumber', label: 'Vehicle Number', type: 'select', options: availableVehicles },
            { name: 'driverName', label: 'Driver Name', type: 'select', options: availableDrivers },
            { name: 'dcCopy', label: 'Upload DC Copy', type: 'file' },
          ]}
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'siteName', label: 'Site' },
            { key: 'dcNumber', label: 'DC Number' },
            { key: 'materialName', label: 'Material' },
            { key: 'quantity', label: 'Quantity' },
            { key: 'vehicleNumber', label: 'Vehicle' },
            { key: 'driverName', label: 'Driver' },
            {
              key: 'dcCopy',
              label: 'DC Copy',
              render: (row) => (row.dcCopy ? <a className="text-link" href={row.dcCopy} target="_blank">View DC</a> : <span className="status warning">Missing</span>),
            },
          ]}
          onAdd={async (record) => {
            const dcCopy = await uploadFormFile(record, 'dcCopy', 'DC Copies');
            setState((previous) => ({
              ...previous,
              wasteInward: [
                ...previous.wasteInward,
                {
                  id: createId('waste'),
                  date: formText(record, 'date'),
                  siteName: formText(record, 'siteName'),
                  dcNumber: formText(record, 'dcNumber'),
                  materialName: formText(record, 'materialName'),
                  quantity: formNumber(record, 'quantity'),
                  vehicleNumber: formText(record, 'vehicleNumber'),
                  driverName: formText(record, 'driverName'),
                  dcCopy,
                },
              ],
              documents: dcCopy
                ? [
                    ...previous.documents,
                    createDocument('DC Copies', 'Waste Inward', formText(record, 'dcNumber'), `${formText(record, 'dcNumber')} DC Copy`, dcCopy),
                  ]
                : previous.documents,
            }));
          }}
          onUpdate={async (id, record) => {
            const existing = state.wasteInward.find((row) => row.id === id);
            const dcCopy = record.dcCopy instanceof File
              ? await uploadFormFile(record, 'dcCopy', 'DC Copies')
              : existing?.dcCopy ?? '';
            setState((previous) => ({
              ...previous,
              wasteInward: updateList(previous.wasteInward, id, {
                date: formText(record, 'date'),
                siteName: formText(record, 'siteName'),
                dcNumber: formText(record, 'dcNumber'),
                materialName: formText(record, 'materialName'),
                quantity: formNumber(record, 'quantity'),
                vehicleNumber: formText(record, 'vehicleNumber'),
                driverName: formText(record, 'driverName'),
                dcCopy,
              }),
            }));
          }}
          onDelete={(id) =>
            setState((previous) => ({
              ...previous,
              wasteInward: deleteFromList(previous.wasteInward, id),
            }))
          }
        />
      );
    case 'vehicles':
      return (
        <GenericModule<VehicleMovementRecord>
          title="Vehicle Movement"
          subtitle="Track clearance, sales, and material delivery trips with driver utilization reports."
          icon={<Truck size={24} />}
          rows={state.vehicleMovements}
          exportName="vehicle-movement-report"
          reportCards={[
            { label: 'Today Trips', value: String(state.vehicleMovements.filter((row) => row.date === today).length) },
            { label: 'Drivers Active', value: String(new Set(state.vehicleMovements.map((row) => row.driverName)).size) },
            { label: 'Vehicles Used', value: String(new Set(state.vehicleMovements.map((row) => row.vehicleNumber)).size) },
          ]}
          fields={[
            { name: 'date', label: 'Date', type: 'date' },
            { name: 'driverName', label: 'Driver Name', type: 'select', options: availableDrivers },
            { name: 'vehicleNumber', label: 'Vehicle Number', type: 'select', options: availableVehicles },
            { name: 'tripNumber', label: 'Trip Number', type: 'text' },
            { name: 'fromLocation', label: 'From Location', type: 'text' },
            { name: 'toLocation', label: 'To Location', type: 'text' },
            { name: 'materialType', label: 'Material Type', type: 'select', options: materials },
            { name: 'purpose', label: 'Purpose', type: 'select', options: ['Clearance', 'Sales', 'Material Delivery'] },
          ]}
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'driverName', label: 'Driver' },
            { key: 'vehicleNumber', label: 'Vehicle' },
            { key: 'tripNumber', label: 'Trip' },
            { key: 'fromLocation', label: 'From' },
            { key: 'toLocation', label: 'To' },
            { key: 'materialType', label: 'Material' },
            { key: 'purpose', label: 'Purpose' },
          ]}
          onAdd={(record) =>
            setState((previous) => ({
              ...previous,
              vehicleMovements: [
                ...previous.vehicleMovements,
                {
                  id: createId('trip'),
                  date: formText(record, 'date'),
                  driverName: formText(record, 'driverName'),
                  vehicleNumber: formText(record, 'vehicleNumber'),
                  tripNumber: formText(record, 'tripNumber'),
                  fromLocation: formText(record, 'fromLocation'),
                  toLocation: formText(record, 'toLocation'),
                  materialType: formText(record, 'materialType'),
                  purpose: formText(record, 'purpose') as VehicleMovementRecord['purpose'],
                },
              ],
            }))
          }
          onUpdate={(id, record) =>
            setState((previous) => ({
              ...previous,
              vehicleMovements: updateList(previous.vehicleMovements, id, {
                date: formText(record, 'date'),
                driverName: formText(record, 'driverName'),
                vehicleNumber: formText(record, 'vehicleNumber'),
                tripNumber: formText(record, 'tripNumber'),
                fromLocation: formText(record, 'fromLocation'),
                toLocation: formText(record, 'toLocation'),
                materialType: formText(record, 'materialType'),
                purpose: formText(record, 'purpose') as VehicleMovementRecord['purpose'],
              }),
            }))
          }
          onDelete={(id) =>
            setState((previous) => ({
              ...previous,
              vehicleMovements: deleteFromList(previous.vehicleMovements, id),
            }))
          }
        />
      );
    case 'sales':
      return (
        <GenericModule<SaleRecord>
          title="Sales Management"
          subtitle="Calculate final quantity, GST, total amount, and vendor-wise monthly revenue."
          icon={<IndianRupee size={24} />}
          rows={state.sales}
          exportName="sales-report"
          reportCards={[
            { label: 'Monthly Revenue', value: currency.format(sum(state.sales.filter((row) => row.date.startsWith(today.slice(0, 7))), (row) => row.finalAmount)) },
            { label: 'Vendors', value: String(new Set(state.sales.map((row) => row.vendorName)).size) },
            { label: 'Material Sold', value: `${number.format(sum(state.sales, (row) => row.finalQuantity))} kg` },
          ]}
          fields={[
            { name: 'date', label: 'Date', type: 'date' },
            { name: 'from', label: 'From', type: 'text' },
            { name: 'to', label: 'To', type: 'text' },
            { name: 'vendorName', label: 'Vendor Name', type: 'text' },
            { name: 'material', label: 'Material', type: 'select', options: materials },
            { name: 'grossQuantity', label: 'Gross Quantity', type: 'number' },
            { name: 'lessQuantity', label: 'Less Quantity', type: 'number' },
            { name: 'ratePerKg', label: 'Rate Per KG', type: 'number' },
            { name: 'gst', label: 'GST %', type: 'number' },
          ]}
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'vendorName', label: 'Vendor' },
            { key: 'material', label: 'Material' },
            { key: 'grossQuantity', label: 'Gross Qty' },
            { key: 'lessQuantity', label: 'Less' },
            { key: 'finalQuantity', label: 'Final Qty' },
            { key: 'ratePerKg', label: 'Rate/KG', render: (row) => currency.format(row.ratePerKg) },
            { key: 'gst', label: 'GST %' },
            { key: 'finalAmount', label: 'Final Amount', render: (row) => currency.format(row.finalAmount) },
          ]}
          onAdd={(record) => {
            const finalQuantity = formNumber(record, 'grossQuantity') - formNumber(record, 'lessQuantity');
            const totalAmount = finalQuantity * formNumber(record, 'ratePerKg');
            const finalAmount = totalAmount * (1 + formNumber(record, 'gst') / 100);
            setState((previous) => ({
              ...previous,
              sales: [
                ...previous.sales,
                {
                  id: createId('sale'),
                  date: formText(record, 'date'),
                  from: formText(record, 'from'),
                  to: formText(record, 'to'),
                  vendorName: formText(record, 'vendorName'),
                  material: formText(record, 'material'),
                  grossQuantity: formNumber(record, 'grossQuantity'),
                  lessQuantity: formNumber(record, 'lessQuantity'),
                  finalQuantity,
                  ratePerKg: formNumber(record, 'ratePerKg'),
                  gst: formNumber(record, 'gst'),
                  totalAmount,
                  finalAmount,
                },
              ],
            }));
          }}
          onUpdate={(id, record) => {
            const finalQuantity = formNumber(record, 'grossQuantity') - formNumber(record, 'lessQuantity');
            const totalAmount = finalQuantity * formNumber(record, 'ratePerKg');
            const finalAmount = totalAmount * (1 + formNumber(record, 'gst') / 100);
            setState((previous) => ({
              ...previous,
              sales: updateList(previous.sales, id, {
                date: formText(record, 'date'),
                from: formText(record, 'from'),
                to: formText(record, 'to'),
                vendorName: formText(record, 'vendorName'),
                material: formText(record, 'material'),
                grossQuantity: formNumber(record, 'grossQuantity'),
                lessQuantity: formNumber(record, 'lessQuantity'),
                finalQuantity,
                ratePerKg: formNumber(record, 'ratePerKg'),
                gst: formNumber(record, 'gst'),
                totalAmount,
                finalAmount,
              }),
            }));
          }}
          onDelete={(id) =>
            setState((previous) => ({
              ...previous,
              sales: deleteFromList(previous.sales, id),
            }))
          }
        />
      );
    case 'stock':
      return <BaleStockModule state={state} setState={setState} />;
    case 'segregation':
      return (
        <GenericModule<SegregationRecord>
          title="Daily Segregation"
          subtitle="Record daily bales produced and productivity per labour."
          icon={<PackageCheck size={24} />}
          rows={state.segregation}
          exportName="segregation-production-report"
          reportCards={[
            { label: 'Today Production', value: `${sum(state.segregation.filter((row) => row.date === today), (row) => row.balesProduced)} bales` },
            { label: 'Monthly Production', value: `${sum(state.segregation.filter((row) => row.date.startsWith(today.slice(0, 7))), (row) => row.balesProduced)} bales` },
            {
              label: 'Productivity',
              value: `${number.format(sum(state.segregation, (row) => row.balesProduced) / Math.max(1, sum(state.segregation, (row) => row.labourCount)))} bales/labour`,
            },
          ]}
          fields={[
            { name: 'date', label: 'Date', type: 'date' },
            { name: 'material', label: 'Material', type: 'select', options: materials },
            { name: 'balesProduced', label: 'Bales Produced', type: 'number' },
            { name: 'labourCount', label: 'Labour Count', type: 'number' },
          ]}
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'material', label: 'Material' },
            { key: 'balesProduced', label: 'Bales Produced' },
            { key: 'labourCount', label: 'Labour Count' },
            {
              key: 'productivity',
              label: 'Productivity',
              render: (row) => `${number.format(row.balesProduced / Math.max(1, row.labourCount))} bales/labour`,
            },
          ]}
          onAdd={(record) =>
            setState((previous) => ({
              ...previous,
              segregation: [
                ...previous.segregation,
                {
                  id: createId('seg'),
                  date: formText(record, 'date'),
                  material: formText(record, 'material'),
                  balesProduced: formNumber(record, 'balesProduced'),
                  labourCount: formNumber(record, 'labourCount'),
                },
              ],
            }))
          }
          onUpdate={(id, record) =>
            setState((previous) => ({
              ...previous,
              segregation: updateList(previous.segregation, id, {
                date: formText(record, 'date'),
                material: formText(record, 'material'),
                balesProduced: formNumber(record, 'balesProduced'),
                labourCount: formNumber(record, 'labourCount'),
              }),
            }))
          }
          onDelete={(id) =>
            setState((previous) => ({
              ...previous,
              segregation: deleteFromList(previous.segregation, id),
            }))
          }
        />
      );
    case 'safety':
      return (
        <GenericModule<SafetyDispatchRecord>
          title="Safety Material Dispatch"
          subtitle="Track safety items like shoes, gloves, masks, uniforms, and brooms sent to sites."
          icon={<ShieldCheck size={24} />}
          rows={state.safetyDispatch}
          exportName="safety-dispatch-history"
          reportCards={[
            { label: 'Dispatch Entries', value: String(state.safetyDispatch.length) },
            { label: 'Total Quantity', value: number.format(sum(state.safetyDispatch, (row) => row.quantity)) },
            { label: 'Sites', value: String(new Set(state.safetyDispatch.map((row) => row.siteName)).size) },
          ]}
          fields={[
            { name: 'date', label: 'Date', type: 'date' },
            { name: 'siteName', label: 'Site Name', type: 'select', options: sites },
            { name: 'dcNumber', label: 'DC Number', type: 'text' },
            { name: 'materialName', label: 'Material Name', type: 'select', options: ['Shoes', 'Gloves', 'Mask', 'Uniform', 'Broom'] },
            { name: 'quantity', label: 'Quantity', type: 'number' },
            { name: 'vehicle', label: 'Vehicle', type: 'select', options: availableVehicles },
            { name: 'driver', label: 'Driver', type: 'select', options: availableDrivers },
          ]}
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'siteName', label: 'Site' },
            { key: 'dcNumber', label: 'DC' },
            { key: 'materialName', label: 'Material' },
            { key: 'quantity', label: 'Qty' },
            { key: 'vehicle', label: 'Vehicle' },
            { key: 'driver', label: 'Driver' },
          ]}
          onAdd={(record) =>
            setState((previous) => ({
              ...previous,
              safetyDispatch: [
                ...previous.safetyDispatch,
                {
                  id: createId('safe'),
                  date: formText(record, 'date'),
                  siteName: formText(record, 'siteName'),
                  dcNumber: formText(record, 'dcNumber'),
                  materialName: formText(record, 'materialName'),
                  quantity: formNumber(record, 'quantity'),
                  vehicle: formText(record, 'vehicle'),
                  driver: formText(record, 'driver'),
                },
              ],
            }))
          }
          onUpdate={(id, record) =>
            setState((previous) => ({
              ...previous,
              safetyDispatch: updateList(previous.safetyDispatch, id, {
                date: formText(record, 'date'),
                siteName: formText(record, 'siteName'),
                dcNumber: formText(record, 'dcNumber'),
                materialName: formText(record, 'materialName'),
                quantity: formNumber(record, 'quantity'),
                vehicle: formText(record, 'vehicle'),
                driver: formText(record, 'driver'),
              }),
            }))
          }
          onDelete={(id) =>
            setState((previous) => ({
              ...previous,
              safetyDispatch: deleteFromList(previous.safetyDispatch, id),
            }))
          }
        />
      );
    case 'purchase':
      return (
        <GenericModule<PurchaseRecord>
          title="Purchase Management"
          subtitle="Track bills from pending to paid with uploads and site-wise expense reporting."
          icon={<ShoppingCart size={24} />}
          rows={state.purchases}
          exportName="purchase-report"
          reportCards={[
            { label: 'Pending Bills', value: String(state.purchases.filter((row) => row.status === 'Pending').length) },
            { label: 'Monthly Purchases', value: currency.format(sum(state.purchases.filter((row) => row.date.startsWith(today.slice(0, 7))), (row) => row.amount)) },
            { label: 'Paid Amount', value: currency.format(sum(state.purchases.filter((row) => row.status === 'Paid'), (row) => row.amount)) },
          ]}
          fields={[
            { name: 'date', label: 'Date', type: 'date' },
            { name: 'category', label: 'Category', type: 'text' },
            { name: 'vendor', label: 'Vendor', type: 'text' },
            { name: 'siteName', label: 'Site', type: 'select', options: sites },
            { name: 'description', label: 'Description', type: 'text' },
            { name: 'amount', label: 'Amount', type: 'number' },
            { name: 'billUpload', label: 'Bill Upload', type: 'file' },
            { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Submitted To Accounts', 'Approved', 'Paid'] },
          ]}
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'category', label: 'Category' },
            { key: 'vendor', label: 'Vendor' },
            { key: 'siteName', label: 'Site' },
            { key: 'amount', label: 'Amount', render: (row) => currency.format(row.amount) },
            { key: 'status', label: 'Status' },
            {
              key: 'billUpload',
              label: 'Bill',
              render: (row) => (row.billUpload ? <a className="text-link" href={row.billUpload} target="_blank">View Bill</a> : <span className="status warning">Missing</span>),
            },
          ]}
          onAdd={async (record) => {
            const billUpload = await uploadFormFile(record, 'billUpload', 'Purchase Invoices');
            setState((previous) => ({
              ...previous,
              purchases: [
                ...previous.purchases,
                {
                  id: createId('pur'),
                  date: formText(record, 'date'),
                  category: formText(record, 'category'),
                  vendor: formText(record, 'vendor'),
                  siteName: formText(record, 'siteName'),
                  description: formText(record, 'description'),
                  amount: formNumber(record, 'amount'),
                  billUpload,
                  status: formText(record, 'status') as PurchaseRecord['status'],
                },
              ],
              documents: billUpload
                ? [
                    ...previous.documents,
                    createDocument('Purchase Invoices', 'Purchase', formText(record, 'vendor'), `${formText(record, 'vendor')} Bill`, billUpload),
                  ]
                : previous.documents,
            }));
          }}
          onUpdate={async (id, record) => {
            const existing = state.purchases.find((row) => row.id === id);
            const billUpload = record.billUpload instanceof File
              ? await uploadFormFile(record, 'billUpload', 'Purchase Invoices')
              : existing?.billUpload ?? '';
            setState((previous) => ({
              ...previous,
              purchases: updateList(previous.purchases, id, {
                date: formText(record, 'date'),
                category: formText(record, 'category'),
                vendor: formText(record, 'vendor'),
                siteName: formText(record, 'siteName'),
                description: formText(record, 'description'),
                amount: formNumber(record, 'amount'),
                billUpload,
                status: formText(record, 'status') as PurchaseRecord['status'],
              }),
            }));
          }}
          onDelete={(id) =>
            setState((previous) => ({
              ...previous,
              purchases: deleteFromList(previous.purchases, id),
            }))
          }
        />
      );
    case 'pettyCash':
      return <PettyCashModule state={state} setState={setState} />;
    case 'accenture':
      return (
        <GenericModule<AccentureEntry>
          title="Accenture Data Entry"
          subtitle="Prepare daily and monthly site-wise exports for the Earth Recycler application."
          icon={<Database size={24} />}
          rows={state.accenture}
          exportName="accenture-earth-recycler-export"
          reportCards={[
            { label: 'Today Quantity', value: `${number.format(sum(state.accenture.filter((row) => row.date === today), (row) => row.quantity))} kg` },
            { label: 'Monthly Quantity', value: `${number.format(sum(state.accenture.filter((row) => row.date.startsWith(today.slice(0, 7))), (row) => row.quantity))} kg` },
            { label: 'Sites', value: String(new Set(state.accenture.map((row) => row.siteName)).size) },
          ]}
          fields={[
            { name: 'date', label: 'Date', type: 'date' },
            { name: 'siteName', label: 'Site Name', type: 'select', options: sites },
            { name: 'material', label: 'Material', type: 'select', options: materials },
            { name: 'quantity', label: 'Quantity', type: 'number' },
          ]}
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'siteName', label: 'Site' },
            { key: 'material', label: 'Material' },
            { key: 'quantity', label: 'Quantity' },
          ]}
          onAdd={(record) =>
            setState((previous) => ({
              ...previous,
              accenture: [
                ...previous.accenture,
                {
                  id: createId('acc'),
                  date: formText(record, 'date'),
                  siteName: formText(record, 'siteName'),
                  material: formText(record, 'material'),
                  quantity: formNumber(record, 'quantity'),
                },
              ],
            }))
          }
          onUpdate={(id, record) =>
            setState((previous) => ({
              ...previous,
              accenture: updateList(previous.accenture, id, {
                date: formText(record, 'date'),
                siteName: formText(record, 'siteName'),
                material: formText(record, 'material'),
                quantity: formNumber(record, 'quantity'),
              }),
            }))
          }
          onDelete={(id) =>
            setState((previous) => ({
              ...previous,
              accenture: deleteFromList(previous.accenture, id),
            }))
          }
        />
      );
    case 'aiReport':
      return <AiReportModule state={state} />;
    case 'aiAuditor':
      return <AiAuditorModule state={state} />;
    case 'documents':
      return <DocumentStorageModule state={state} setState={setState} />;
    default:
      return <Dashboard state={state} />;
  }
}

function App() {
  const [state, setState] = React.useState<AppState>(emptyState);
  const [activeModule, setActiveModule] = React.useState<ModuleKey>('dashboard');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? '');
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? '');
    });

    return () => data.subscription.unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!userEmail) return;

    if (!isSupabaseConfigured) {
      setState(seedState);
      return;
    }

    setLoading(true);
    setError('');
    loadAppState()
      .then(setState)
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [userEmail]);

  const persistSetState = React.useCallback<React.Dispatch<React.SetStateAction<AppState>>>(
    (action) => {
      setState((previous) => {
        const next = typeof action === 'function' ? action(previous) : action;
        if (isSupabaseConfigured) {
          persistStateChanges(previous, next).catch((saveError: Error) => {
            setError(saveError.message);
          });
        }
        return next;
      });
    },
    [],
  );

  async function logout() {
    await supabase?.auth.signOut();
    setUserEmail('');
    setState(emptyState);
  }

  if (!userEmail) return <Login onLogin={setUserEmail} />;

  return (
    <div className="app-shell">
      <Sidebar
        activeModule={activeModule}
        onSelect={setActiveModule}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <main className="main-area">
        <Header
          activeModule={activeModule}
          userEmail={userEmail}
          onLogout={logout}
          onMenu={() => setMenuOpen(true)}
        />
        {error && <div className="app-alert">{error}</div>}
        {loading ? <div className="loading-panel">Loading Supabase data...</div> : buildModule(activeModule, state, persistSetState)}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
