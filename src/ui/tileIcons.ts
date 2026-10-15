import {
  Clock,
  Cpu,
  FileArchive,
  HardDrive,
  Laptop,
  ListChecks,
  Package,
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import type { TileId } from '../domain/types';

export const TILE_ICON: Record<TileId, LucideIcon> = {
  deviceStatus: Laptop,
  compliance: ShieldCheck,
  checkIn: Clock,
  osVersion: Cpu,
  bitlocker: HardDrive,
  defender: Shield,
  policies: ListChecks,
  entraJoin: UserCheck,
  win32Apps: Package,
  enrollment: UserPlus,
  diagCollection: FileArchive,
};
