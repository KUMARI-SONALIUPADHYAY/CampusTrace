
import { Item, ItemType, ItemStatus, Category } from './types';

export const INITIAL_ITEMS: Item[] = [
  {
    id: '1',
    title: 'MacBook Air M2 Silver',
    type: ItemType.LOST,
    category: Category.ELECTRONICS,
    location: 'Engineering Hall Lab 3',
    date: '2024-05-15',
    description: 'Silver MacBook with a stickers of a rocket ship on the lid. Left it on the desk near the window.',
    status: ItemStatus.UNCLAIMED,
    userId: 'user-1',
    claims: [],
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Blue Water Bottle',
    type: ItemType.FOUND,
    category: Category.OTHER,
    location: 'Campus Gym Cardio Zone',
    date: '2024-05-18',
    description: 'Hydro Flask style, blue, has some scratches at the bottom.',
    status: ItemStatus.UNCLAIMED,
    userId: 'user-2',
    claims: [],
    createdAt: new Date().toISOString()
  },
  {
    id: '3',
    title: 'Dorm Keys - Green Lanyard',
    type: ItemType.FOUND,
    category: Category.KEYS,
    location: 'Main Library Level 2',
    date: '2024-05-19',
    description: 'Found a set of 3 keys on a green university lanyard near the study pods.',
    status: ItemStatus.PENDING_APPROVAL,
    userId: 'user-3',
    claims: [],
    createdAt: new Date().toISOString()
  }
];
