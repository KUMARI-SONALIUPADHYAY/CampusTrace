
export enum ItemType {
  LOST = 'LOST',
  FOUND = 'FOUND'
}

export enum ItemStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  UNCLAIMED = 'UNCLAIMED',
  CLAIM_REQUESTED = 'CLAIM_REQUESTED',
  RETURNED = 'RETURNED'
}

export enum Category {
  ELECTRONICS = 'Electronics',
  BOOKS = 'Books & Stationery',
  CLOTHING = 'Clothing & Accessories',
  KEYS = 'Keys',
  CARDS = 'Cards & IDs',
  OTHER = 'Other'
}

export interface User {
  id: string;
  email: string;
  role: 'STUDENT' | 'ADMIN';
}

export interface ClaimRequest {
  id: string;
  userId: string;
  userEmail: string;
  message: string;
  contact: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface Item {
  id: string;
  title: string;
  type: ItemType;
  category: Category;
  location: string;
  date: string;
  description: string;
  imageUrl?: string;
  status: ItemStatus;
  userId: string;
  claims: ClaimRequest[];
  createdAt: string;
}

export interface AppState {
  items: Item[];
  currentUser: User | null;
}
