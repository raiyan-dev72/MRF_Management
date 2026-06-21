import { AppState } from '../types';
import { isSupabaseConfigured, supabase } from './supabase';

type StateListKey = {
  [K in keyof AppState]: AppState[K] extends Array<Record<string, unknown>> ? K : never;
}[keyof AppState];

type DbRecord = Record<string, string | number | boolean | null | undefined>;

interface TableConfig {
  table: string;
  orderBy?: string;
  toApp: (row: DbRecord) => Record<string, unknown>;
  toDb: (row: Record<string, unknown>) => DbRecord;
}

export const emptyState: AppState = {
  staff: [],
  attendance: [],
  wasteInward: [],
  vehicleMovements: [],
  sales: [],
  baleStock: [],
  segregation: [],
  safetyDispatch: [],
  purchases: [],
  pettyCash: [],
  accenture: [],
  documents: [],
  drivers: [],
  vehicles: [],
  pettyCashOpeningBalance: 0,
};

function num(value: unknown) {
  return Number(value ?? 0);
}

const identity = (row: DbRecord) => row as Record<string, unknown>;

export const tableConfigs: Record<StateListKey, TableConfig> = {
  staff: {
    table: 'staff',
    orderBy: 'name',
    toApp: (row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      dailyRate: num(row.daily_rate),
      active: row.active ?? true,
    }),
    toDb: (row) => ({
      id: row.id as string,
      name: row.name as string,
      type: row.type as string,
      daily_rate: num(row.dailyRate),
      active: Boolean(row.active ?? true),
    }),
  },
  attendance: {
    table: 'attendance',
    orderBy: 'date',
    toApp: (row) => ({
      id: row.id,
      date: row.date,
      staffId: row.staff_id,
      status: row.status,
      dailyRate: num(row.daily_rate),
    }),
    toDb: (row) => ({
      id: row.id as string,
      date: row.date as string,
      staff_id: row.staffId as string,
      status: row.status as string,
      daily_rate: num(row.dailyRate),
    }),
  },
  wasteInward: {
    table: 'waste_inward',
    orderBy: 'date',
    toApp: (row) => ({
      id: row.id,
      date: row.date,
      siteName: row.site_name,
      dcNumber: row.dc_number,
      materialName: row.material_name,
      quantity: num(row.quantity),
      vehicleNumber: row.vehicle_number,
      driverName: row.driver_name,
      dcCopy: row.dc_copy ?? '',
    }),
    toDb: (row) => ({
      id: row.id as string,
      date: row.date as string,
      site_name: row.siteName as string,
      dc_number: row.dcNumber as string,
      material_name: row.materialName as string,
      quantity: num(row.quantity),
      vehicle_number: row.vehicleNumber as string,
      driver_name: row.driverName as string,
      dc_copy: (row.dcCopy as string) || null,
    }),
  },
  vehicleMovements: {
    table: 'vehicle_movements',
    orderBy: 'date',
    toApp: (row) => ({
      id: row.id,
      date: row.date,
      driverName: row.driver_name,
      vehicleNumber: row.vehicle_number,
      tripNumber: row.trip_number,
      fromLocation: row.from_location,
      toLocation: row.to_location,
      materialType: row.material_type,
      purpose: row.purpose,
    }),
    toDb: (row) => ({
      id: row.id as string,
      date: row.date as string,
      driver_name: row.driverName as string,
      vehicle_number: row.vehicleNumber as string,
      trip_number: row.tripNumber as string,
      from_location: row.fromLocation as string,
      to_location: row.toLocation as string,
      material_type: row.materialType as string,
      purpose: row.purpose as string,
    }),
  },
  sales: {
    table: 'sales',
    orderBy: 'date',
    toApp: (row) => ({
      id: row.id,
      date: row.date,
      from: row.from_location,
      to: row.to_location,
      vendorName: row.vendor_name,
      material: row.material,
      grossQuantity: num(row.gross_quantity),
      lessQuantity: num(row.less_quantity),
      finalQuantity: num(row.final_quantity),
      ratePerKg: num(row.rate_per_kg),
      gst: num(row.gst),
      totalAmount: num(row.total_amount),
      finalAmount: num(row.final_amount),
    }),
    toDb: (row) => ({
      id: row.id as string,
      date: row.date as string,
      from_location: row.from as string,
      to_location: row.to as string,
      vendor_name: row.vendorName as string,
      material: row.material as string,
      gross_quantity: num(row.grossQuantity),
      less_quantity: num(row.lessQuantity),
      final_quantity: num(row.finalQuantity),
      rate_per_kg: num(row.ratePerKg),
      gst: num(row.gst),
      total_amount: num(row.totalAmount),
      final_amount: num(row.finalAmount),
    }),
  },
  baleStock: {
    table: 'bale_stock',
    orderBy: 'material',
    toApp: (row) => ({
      id: row.id,
      material: row.material,
      produced: num(row.produced),
      sold: num(row.sold),
      threshold: num(row.threshold),
    }),
    toDb: (row) => ({
      id: row.id as string,
      material: row.material as string,
      produced: num(row.produced),
      sold: num(row.sold),
      threshold: num(row.threshold),
    }),
  },
  segregation: {
    table: 'segregation',
    orderBy: 'date',
    toApp: (row) => ({
      id: row.id,
      date: row.date,
      material: row.material,
      balesProduced: num(row.bales_produced),
      labourCount: num(row.labour_count),
    }),
    toDb: (row) => ({
      id: row.id as string,
      date: row.date as string,
      material: row.material as string,
      bales_produced: num(row.balesProduced),
      labour_count: num(row.labourCount),
    }),
  },
  safetyDispatch: {
    table: 'safety_dispatch',
    orderBy: 'date',
    toApp: (row) => ({
      id: row.id,
      date: row.date,
      siteName: row.site_name,
      dcNumber: row.dc_number,
      materialName: row.material_name,
      quantity: num(row.quantity),
      vehicle: row.vehicle,
      driver: row.driver,
    }),
    toDb: (row) => ({
      id: row.id as string,
      date: row.date as string,
      site_name: row.siteName as string,
      dc_number: row.dcNumber as string,
      material_name: row.materialName as string,
      quantity: num(row.quantity),
      vehicle: row.vehicle as string,
      driver: row.driver as string,
    }),
  },
  purchases: {
    table: 'purchases',
    orderBy: 'date',
    toApp: (row) => ({
      id: row.id,
      date: row.date,
      category: row.category,
      vendor: row.vendor,
      siteName: row.site_name,
      description: row.description,
      amount: num(row.amount),
      billUpload: row.bill_upload ?? '',
      status: row.status,
    }),
    toDb: (row) => ({
      id: row.id as string,
      date: row.date as string,
      category: row.category as string,
      vendor: row.vendor as string,
      site_name: row.siteName as string,
      description: row.description as string,
      amount: num(row.amount),
      bill_upload: (row.billUpload as string) || null,
      status: row.status as string,
    }),
  },
  pettyCash: {
    table: 'petty_cash',
    orderBy: 'date',
    toApp: (row) => ({
      id: row.id,
      voucherNumber: row.voucher_number,
      date: row.date,
      category: row.category,
      description: row.description,
      amount: num(row.amount),
      billUpload: row.bill_upload ?? '',
      paymentMode: row.payment_mode,
    }),
    toDb: (row) => ({
      id: row.id as string,
      voucher_number: row.voucherNumber as string,
      date: row.date as string,
      category: row.category as string,
      description: row.description as string,
      amount: num(row.amount),
      bill_upload: (row.billUpload as string) || null,
      payment_mode: row.paymentMode as string,
    }),
  },
  accenture: {
    table: 'accenture_entries',
    orderBy: 'date',
    toApp: (row) => ({
      id: row.id,
      date: row.date,
      siteName: row.site_name,
      material: row.material,
      quantity: num(row.quantity),
    }),
    toDb: (row) => ({
      id: row.id as string,
      date: row.date as string,
      site_name: row.siteName as string,
      material: row.material as string,
      quantity: num(row.quantity),
    }),
  },
  documents: {
    table: 'documents',
    orderBy: 'date',
    toApp: (row) => ({
      id: row.id,
      date: row.date,
      name: row.name,
      category: row.category,
      year: row.year,
      month: row.month,
      sourceModule: row.source_module,
      linkedRecord: row.linked_record,
      url: row.url ?? '',
    }),
    toDb: (row) => ({
      id: row.id as string,
      date: row.date as string,
      name: row.name as string,
      category: row.category as string,
      year: row.year as string,
      month: row.month as string,
      source_module: row.sourceModule as string,
      linked_record: row.linkedRecord as string,
      url: (row.url as string) || null,
    }),
  },
  drivers: {
    table: 'drivers',
    orderBy: 'name',
    toApp: identity,
    toDb: identity,
  },
  vehicles: {
    table: 'vehicles',
    orderBy: 'vehicle_number',
    toApp: (row) => ({
      id: row.id,
      vehicleNumber: row.vehicle_number,
      active: row.active ?? true,
    }),
    toDb: (row) => ({
      id: row.id as string,
      vehicle_number: row.vehicleNumber as string,
      active: Boolean(row.active ?? true),
    }),
  },
};

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  return supabase;
}

async function fetchList(key: StateListKey) {
  const client = requireSupabase();
  const config = tableConfigs[key];
  let query = client.from(config.table).select('*');

  if (config.orderBy) {
    query = query.order(config.orderBy, { ascending: key === 'staff' || key === 'drivers' || key === 'vehicles' });
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => config.toApp(row as DbRecord));
}

export async function loadAppState(): Promise<AppState> {
  const [
    staff,
    attendance,
    wasteInward,
    vehicleMovements,
    sales,
    baleStock,
    segregation,
    safetyDispatch,
    purchases,
    pettyCash,
    accenture,
    documents,
    drivers,
    vehicles,
  ] = await Promise.all([
    fetchList('staff'),
    fetchList('attendance'),
    fetchList('wasteInward'),
    fetchList('vehicleMovements'),
    fetchList('sales'),
    fetchList('baleStock'),
    fetchList('segregation'),
    fetchList('safetyDispatch'),
    fetchList('purchases'),
    fetchList('pettyCash'),
    fetchList('accenture'),
    fetchList('documents'),
    fetchList('drivers'),
    fetchList('vehicles'),
  ]);

  const { data: settingRows, error } = await requireSupabase()
    .from('settings')
    .select('value')
    .eq('key', 'petty_cash_opening_balance')
    .maybeSingle();

  if (error) throw error;

  return {
    staff: staff as AppState['staff'],
    attendance: attendance as AppState['attendance'],
    wasteInward: wasteInward as AppState['wasteInward'],
    vehicleMovements: vehicleMovements as AppState['vehicleMovements'],
    sales: sales as AppState['sales'],
    baleStock: baleStock as AppState['baleStock'],
    segregation: segregation as AppState['segregation'],
    safetyDispatch: safetyDispatch as AppState['safetyDispatch'],
    purchases: purchases as AppState['purchases'],
    pettyCash: pettyCash as AppState['pettyCash'],
    accenture: accenture as AppState['accenture'],
    documents: documents as AppState['documents'],
    drivers: drivers as AppState['drivers'],
    vehicles: vehicles as AppState['vehicles'],
    pettyCashOpeningBalance: num(settingRows?.value ?? 0),
  };
}

export async function insertRecord(key: StateListKey, row: Record<string, unknown>) {
  const config = tableConfigs[key];
  const { error } = await requireSupabase().from(config.table).insert(config.toDb(row));
  if (error) throw error;
}

export async function updateRecord(key: StateListKey, row: Record<string, unknown>) {
  const config = tableConfigs[key];
  const { id, ...dbRow } = config.toDb(row);
  const { error } = await requireSupabase().from(config.table).update(dbRow).eq('id', id);
  if (error) throw error;
}

export async function deleteRecord(key: StateListKey, id: string) {
  const config = tableConfigs[key];
  const { error } = await requireSupabase().from(config.table).delete().eq('id', id);
  if (error) throw error;
}

export async function savePettyCashOpeningBalance(value: number) {
  const { error } = await requireSupabase().from('settings').upsert({
    key: 'petty_cash_opening_balance',
    value,
  });

  if (error) throw error;
}

function changed(previous: Record<string, unknown>, next: Record<string, unknown>) {
  return JSON.stringify(previous) !== JSON.stringify(next);
}

export async function persistStateChanges(previous: AppState, next: AppState) {
  const keys = Object.keys(tableConfigs) as StateListKey[];

  for (const key of keys) {
    const previousRows = previous[key] as Array<Record<string, unknown>>;
    const nextRows = next[key] as Array<Record<string, unknown>>;
    const previousById = new Map(previousRows.map((row) => [String(row.id), row]));
    const nextById = new Map(nextRows.map((row) => [String(row.id), row]));

    for (const row of nextRows) {
      const previousRow = previousById.get(String(row.id));
      if (!previousRow) {
        await insertRecord(key, row);
      } else if (changed(previousRow, row)) {
        await updateRecord(key, row);
      }
    }

    for (const row of previousRows) {
      if (!nextById.has(String(row.id))) {
        await deleteRecord(key, String(row.id));
      }
    }
  }

  if (previous.pettyCashOpeningBalance !== next.pettyCashOpeningBalance) {
    await savePettyCashOpeningBalance(next.pettyCashOpeningBalance);
  }
}
