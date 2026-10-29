import { Toaster as HotToaster } from 'react-hot-toast';
import { theme } from '@/styles/theme';

export function Toaster() {
  return (
    <HotToaster
      position="top-center"
      toastOptions={{
        duration: 4000,
        style: {
          background: theme.colors.bgSurface,
          color: theme.colors.textPrimary,
          border: `1px solid ${theme.colors.borderSubtle}`,
          borderRadius: '8px',
          padding: '10px 18px',
          fontSize: '14px',
          fontWeight: 600,
          boxShadow: '0 4px 14px -4px rgba(16,24,40,0.18)',
        },
        success: {
          iconTheme: {
            primary: theme.colors.accentPrimary,
            secondary: '#FFFFFF',
          },
        },
        error: {
          iconTheme: {
            primary: theme.colors.danger,
            secondary: '#FFFFFF',
          },
        },
      }}
    />
  );
}
