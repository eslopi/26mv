import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { AuthButton } from '@/components/ui/auth-button';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return null;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 space-y-4">
          <h1 className="text-2xl font-bold text-center">{t('loginRequired')}</h1>
          <p className="text-center text-muted-foreground">
            {t('loginRequiredMessage')}
          </p>
          <div className="flex justify-center">
            <AuthButton />
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}