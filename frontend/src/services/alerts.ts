import api from '@/services/api';

export interface WalkinAlert {
  id: string;
  city: string;
}

export interface NewDrives {
  total_new: number;
  cities: { city: string; new: number }[];
}

export async function fetchAlerts(): Promise<WalkinAlert[]> {
  return (await api.get<WalkinAlert[]>('/alerts')).data;
}

export async function addAlert(city: string): Promise<WalkinAlert[]> {
  return (await api.post<WalkinAlert[]>('/alerts', { city })).data;
}

export async function removeAlert(id: string): Promise<void> {
  await api.delete(`/alerts/${id}`);
}

export async function fetchNewDrives(): Promise<NewDrives> {
  return (await api.get<NewDrives>('/alerts/new')).data;
}

export async function markAlertsSeen(): Promise<void> {
  await api.post('/alerts/seen');
}
