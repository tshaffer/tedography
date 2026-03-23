export interface Person {
  id: string;
  displayName: string;
  sortName?: string | null;
  aliases?: string[];
  notes?: string | null;
  isHidden?: boolean;
  isArchived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
