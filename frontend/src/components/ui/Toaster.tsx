import { Toaster as HotToaster } from 'react-hot-toast';
import { theme } from '@/styles/theme';

export function Toaster() {
  return (
    <HotToaster
      position="top-center"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'rgba(27, 27, 46, 0.92)',
          backdropFilter: 'blur(12px)',
          color: theme.colors.textPrimary,
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '9999px',
          padding: '10px 18px',
          fontSize: '14px',
          fontWeight: 600,
          boxShadow: '0 12px 30px -10px rgba(0,0,0,0.7)',
        },
        success: {
          iconTheme: {
            primary: theme.colors.accentPrimary,
            secondary: theme.colors.bgBase,
          },
        },
        error: {
          iconTheme: {
            primary: theme.colors.danger,
            secondary: theme.colors.bgBase,
          },
        },
      }}
    />
  );
}
