'use client';
import { useState } from 'react';
import { useAuth } from '@/firebase';
import { initiateEmailSignIn, initiateEmailSignUp } from '@/firebase/non-blocking-login';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from './icons';
import { Alert, AlertDescription } from './ui/alert';

export function AuthGate() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setAuthError(null);
  }

  const handleSignIn = () => {
    setAuthError(null);
    initiateEmailSignIn(auth, email, password, (error) => {
       if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setAuthError('Invalid credentials. Please check your email and password.');
      } else {
        setAuthError('An unexpected error occurred. Please try again.');
      }
    });
  };

  const handleSignUp = async () => {
    setAuthError(null);
    await initiateEmailSignUp(auth, email, password, firstName, lastName, (error) => {
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('This email is already in use. Please sign in instead.');
      } else {
        setAuthError('An unexpected error occurred during sign up. Please try again.');
      }
    });
  };

  const toggleForm = () => {
    setIsSignUp(!isSignUp);
    clearForm();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="absolute bottom-4 left-4">
            <Icons.logo className="h-8 w-8 text-muted-foreground" />
        </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center text-2xl text-primary">
            <Icons.logo className="mr-2 h-8 w-8" />
            <span>{isSignUp ? 'Create your account' : 'Sign In'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {authError && (
              <Alert variant="destructive">
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
          )}
          {isSignUp && (
            <>
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{isSignUp ? 'Email' : 'Email'}</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {isSignUp && <p className="text-xs text-muted-foreground">You'll need to verify your email later.</p>}
          </div>
          <div className="space-y-2 relative">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type={showPassword ? 'text' : 'password'} 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="pr-10"
            />
             <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
             </Button>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <Button onClick={isSignUp ? handleSignUp : handleSignIn} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            {isSignUp ? 'Next' : 'Sign In'}
          </Button>
           {isSignUp && <p className="text-xs text-center text-muted-foreground">By creating an account, you confirm that you are a licensed healthcare professional.</p>}
          <p className="text-sm">
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <Button variant="link" className="p-0 h-auto" onClick={toggleForm}>
              {isSignUp ? 'Sign in' : 'Sign up'}
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
