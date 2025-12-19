
// Centralized utility functions for formatting data

export const formatMoney = (val: number | string): string => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (val === undefined || val === null || isNaN(num)) return '0.00';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};

export const formatDateSafely = (dateStr: any): string => {
  if (!dateStr) return 'N/A';
  // Handle strings that might be in UTC but missing 'Z' or specific formats
  const normalizedStr = typeof dateStr === 'string' ? dateStr.replace(' ', 'T') : dateStr;
  const d = new Date(normalizedStr);
  if (isNaN(d.getTime())) return 'N/A';
  // Filter out epoch start dates often used as defaults
  if (d.getFullYear() <= 1970 && d.getMonth() === 0 && d.getDate() === 1) return 'N/A';
  return d.toLocaleDateString();
};

export const getStatusColor = (status: string): "green" | "yellow" | "red" | "blue" | "gray" | "orange" | "purple" => {
  const s = (status || '').toLowerCase();
  if (s.includes('paid') || s.includes('complete') || s.includes('active') || s.includes('recover') || s.includes('approved')) return 'green';
  if (s.includes('pending') || s.includes('waiting') || s.includes('reserved') || s.includes('confirm') || s.includes('partial')) return 'yellow';
  if (s.includes('cancelled') || s.includes('refund') || s.includes('overdue') || s.includes('reject') || s.includes('decease') || s.includes('ama')) return 'red';
  if (s.includes('admitted') || s.includes('inpatient')) return 'purple';
  if (s.includes('outpatient')) return 'blue';
  if (s.includes('emergency')) return 'orange';
  return 'blue'; // Default
};

export const translateStatus = (status: string, t: (key: string) => string): string => {
  const s = (status || '').toLowerCase();
  if (s === 'paid') return t('billing_status_paid');
  if (s === 'pending') return t('billing_status_pending');
  if (s === 'partial') return t('billing_status_partial');
  if (s === 'overdue') return t('billing_status_overdue');
  if (s === 'refunded') return t('billing_status_refunded');
  if (s === 'cancelled') return t('appointments_status_cancelled');
  return status; // Fallback to original string if no translation needed/found
};
