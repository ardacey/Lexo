import React, { useState, useEffect, useRef } from 'react';
import { usePracticeStore } from '../store/usePracticeStore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '../components/ui/badge';
import { Loader2, Clock, Target, Trophy, PlayCircle } from 'lucide-react';

interface PracticeModeProps {
  onBack: () => void;
}

const PracticeMode: React.FC<PracticeModeProps> = ({ onBack }) => {
  const [duration, setDuration] = useState(300);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    sessionId,
    isActive,
    loading,
    letterPool,
    score,
    wordsFound,
    timeRemaining,
    results,
    currentWord,
    lastSubmission,
    startSession,
    submitWord,
    updateStatus,
    endSession,
    setCurrentWord,
    resetSession,
  } = usePracticeStore();

  useEffect(() => {
    if (!isActive || !sessionId) return;
    
    const interval = setInterval(() => {
      updateStatus();
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isActive, sessionId, updateStatus]);

  useEffect(() => {
    const handleEndSessionAuto = async () => {
      try {
        await endSession();
        setShowResults(true);
      } catch (error) {
        console.error('Failed to auto-end session:', error);
      }
    };

    if (sessionId && !isActive && timeRemaining <= 0 && !results) {
      handleEndSessionAuto();
    }
  }, [isActive, timeRemaining, sessionId, results, endSession]);

  const handleStartSession = async () => {
    try {
      await startSession(duration);
      setShowResults(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 500);
    } catch (error) {
      console.error('Failed to start session:', error);
      toast.error('Failed to start practice session');
    }
  };

  const handleSubmitWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWord.trim() || loading) return;
    
    try {
      await submitWord(currentWord.trim());
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('Failed to submit word:', error);
      toast.error('Failed to submit word');
    }
  };

  const handleEndSession = async () => {
    try {
      await endSession();
      setShowResults(true);
    } catch (error) {
      console.error('Failed to end session:', error);
      toast.error('Failed to end session');
    }
  };

  const handleNewSession = () => {
    resetSession();
    setShowResults(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDurationOptions = () => [
    { value: 180, label: '3 minutes' },
    { value: 300, label: '5 minutes' },
    { value: 600, label: '10 minutes' },
    { value: 900, label: '15 minutes' },
  ];

  if (showResults && results) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-500" />
              Practice Completed!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{results.final_score}</div>
                <div className="text-sm text-blue-500">Total Score</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{results.total_words}</div>
                <div className="text-sm text-green-500">Words Found</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {results.words_per_minute.toFixed(1)}
                </div>
                <div className="text-sm text-purple-500">Words/Minute</div>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {formatTime(Math.floor(results.duration))}
                </div>
                <div className="text-sm text-orange-500">Duration</div>
              </div>
            </div>
            
            {results.words_found.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Found Words:</h3>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {results.words_found.map((word, index) => (
                    <Badge key={index} variant="secondary">
                      {word}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex gap-3 justify-center">
              <Button onClick={handleNewSession} className="flex items-center gap-2">
                <PlayCircle className="h-4 w-4" />
                New Practice
              </Button>
              <Button variant="outline" onClick={onBack}>
                Back to Menu
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sessionId && isActive) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <span className="font-mono text-lg">
                {formatTime(Math.max(0, Math.floor(timeRemaining)))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              <span className="font-bold text-lg">{score} points</span>
            </div>
            <div className="text-sm text-gray-600">
              {wordsFound.length} words found
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleEndSession}>
            End
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Letters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 justify-center">
              {letterPool.map((letter, index) => (
                <div
                  key={index}
                  className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center font-bold text-blue-800 cursor-pointer hover:bg-blue-200 transition-colors"
                  onClick={() => {
                    setCurrentWord(currentWord + letter);
                    inputRef.current?.focus();
                  }}
                >
                  {letter.toUpperCase()}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmitWord} className="space-y-4">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  type="text"
                  value={currentWord}
                  onChange={(e) => setCurrentWord(e.target.value.toLowerCase())}
                  placeholder="Type a word..."
                  className="flex-1"
                  disabled={loading}
                />
                <Button type="submit" disabled={!currentWord.trim() || loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Submit
                </Button>
              </div>
              
              {lastSubmission && (
                <div className={`p-3 rounded-lg ${
                  lastSubmission.success 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {lastSubmission.message}
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {wordsFound.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Found Words ({wordsFound.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {wordsFound.map((word, index) => (
                  <Badge key={index} variant="secondary">
                    {word}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Target className="h-6 w-6 text-blue-500" />
            Practice Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Practice Duration
            </label>
            <div className="grid grid-cols-2 gap-2">
              {getDurationOptions().map((option) => (
                <Button
                  key={option.value}
                  variant={duration === option.value ? "default" : "outline"}
                  onClick={() => setDuration(option.value)}
                  className="w-full"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="text-sm text-gray-600 space-y-2">
            <p>• Create words from the given letters</p>
            <p>• Each correct word earns points</p>
            <p>• Race against time and improve yourself</p>
          </div>
          
          <div className="flex gap-3">
            <Button 
              onClick={handleStartSession} 
              disabled={loading}
              className="flex-1"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Start
            </Button>
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PracticeMode;
