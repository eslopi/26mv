import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await updateUserData(user);
      }
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateUserData = async (user: User) => {
    if (!user.uid) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      const userData = {
        email: user.email,
        lastLogin: new Date(),
      };

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          ...userData,
          createdAt: new Date(),
        });
      } else {
        await setDoc(userRef, userData, { merge: true });
      }
    } catch (error) {
      console.error('Error updating user data:', error);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateUserData(result.user);
      toast({
        title: 'Welcome',
        description: 'Account created successfully',
        duration: 3000,
      });
    } catch (error: any) {
      console.error('Sign-up error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create account',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: 'Welcome back',
        description: 'Signed in successfully',
        duration: 3000,
      });
    } catch (error: any) {
      console.error('Sign-in error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign in',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
      toast({
        title: 'Signed out',
        description: 'You have been signed out successfully',
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: 'Error',
        description: 'Failed to sign out. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}