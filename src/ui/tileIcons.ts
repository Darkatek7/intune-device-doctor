import {
  AppWindow,
  Clock,
  Cpu,
  FileArchive,
  HardDrive,
  Laptop,
  ListChecks,
  Network,
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
  apps: AppWindow,
  entraJoin: UserCheck,
  win32Apps: Package,
  enrollment: UserPlus,
  certsNetwork: Network,
  diagCollection: FileArchive,
};
