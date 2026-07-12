export interface SavedAddress {
  _id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface AddressForm {
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface NearbyStore {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  phone?: string;
  distanceKm: number;
  today: { open: string | null; close: string | null; isOpen: boolean };
  stock: { status: "UNKNOWN" | "ALL_IN_STOCK" | "TRANSFER_NEEDED"; message: string; transferCount?: number };
}

export interface SlotDay {
  date: string;
  slots: { label: string; start: string; end: string; remaining: number; available: boolean; sameDayReady?: string }[];
}

export interface CheckoutSelection {
  deliveryMethod: "HOME" | "PICKUP" | null;
  addressId?: string;
  address?: AddressForm;
  etaDays?: number;
  storeId?: string;
  storeName?: string;
  appointment?: { date: string; timeSlot: string };
}
