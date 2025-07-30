import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface WordInputProps {
  value: string;
  onChange: (value: string) => void;
  onSendWord: () => void;
  disabled: boolean;
}

const WordInput: React.FC<WordInputProps> = ({ value, onChange, onSendWord, disabled }) => {
  
  const handleSend = () => {
    if (value.trim()) {
      onSendWord();
    }
  };

  return (
    <div className="flex w-full max-w-sm items-center space-x-2 my-4">
      <Input
        type="text"
        placeholder="Type a word..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSend();
        }}
        disabled={disabled}
        className="bg-slate-200 text-slate-900 text-lg placeholder:text-slate-500"
      />
      <Button onClick={handleSend} disabled={disabled || !value.trim()} className="text-lg">
        Send
      </Button>
    </div>
  );
};

export default WordInput;