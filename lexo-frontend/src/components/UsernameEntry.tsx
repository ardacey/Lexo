import React, { useState } from 'react';
import { validateUsername } from '../utils/validation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  onUsernameSubmit: (username: string) => void;
}

const UsernameEntry: React.FC<Props> = ({ onUsernameSubmit }) => {
  const [username, setUsername] = useState('');

  const handleSubmit = () => {
    const trimmedUsername = username.trim();
    
    const validation = validateUsername(trimmedUsername);
    if (!validation.valid) {
      toast.error(validation.message || 'Invalid username');
      return;
    }
    
    onUsernameSubmit(trimmedUsername);
  };

  return (
    <Card className="w-[350px] bg-white border-slate-200">
      <CardHeader>
        <CardTitle className="text-2xl text-cyan-600">Welcome to Lexo</CardTitle>
        <CardDescription>Enter a username to begin.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex w-full max-w-sm items-center space-x-2">
          <Input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <Button onClick={handleSubmit} variant="outline" className="border-cyan-500 text-cyan-600 hover:bg-cyan-500 hover:text-white">
            Enter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default UsernameEntry;