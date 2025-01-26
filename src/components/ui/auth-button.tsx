import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function AuthButton() {
  const { user, signIn, signUp, logout } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      setIsOpen(false);
      setEmail('');
      setPassword('');
    } catch (error) {
      console.error('Authentication error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (user) {
    return (
      <Button variant="outline" onClick={logout}>
        <LogOut className="h-4 w-4 mr-2" />
        {t('signOut')}
      </Button>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <User className="h-4 w-4 mr-2" />
          {t('signIn')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isSignUp ? t('createAccount') : t('signIn')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder={t('email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
            <Input
              type="password"
              placeholder={t('password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-col space-y-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center">
                  <span className="animate-spin mr-2">⏳</span>
                  {isSignUp ? t('creating') : t('signingIn')}
                </span>
              ) : (
                isSignUp ? t('createAccount') : t('signIn')
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsSignUp(!isSignUp)}
              disabled={isLoading}
            >
              {isSignUp ? t('alreadyHaveAccount') : t('needAccount')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}