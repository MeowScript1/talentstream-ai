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
          border: `1px solid ${theme.colors.textPrimary}`,
          borderRadius: '4px',
          padding: '10px 18px',
          fontSize: '14px',
          fontWeight: 600,
          boxShadow: 'none',
        },
        success: {
          iconTheme: {
            primary: theme.colors.accentPrimary,
            secondary: theme.colors.bgSurface,
          },
        },
        error: {
          iconTheme: {
            primary: theme.colors.danger,
            secondary: theme.colors.bgSurface,
          },
        },
      }}
    />
  );
}
