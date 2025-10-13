/**
 * Tests for GameComponents
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Animated } from 'react-native';
import {
  GameHeader,
  LetterPool,
  WordInput,
  WordsList,
} from '../GameComponents';

describe('GameComponents', () => {
  describe('GameHeader', () => {
    const defaultProps = {
      timeLeft: 60,
      formatTime: '01:00',
      totalScore: 0,
      onBack: jest.fn(),
      pulseAnim: new Animated.Value(1),
    };

    it('renders correctly with default props', () => {
      const { getByText } = render(<GameHeader {...defaultProps} />);
      
      expect(getByText('← Geri')).toBeTruthy();
      expect(getByText('01:00')).toBeTruthy();
      expect(getByText('Skor')).toBeTruthy();
      expect(getByText('0')).toBeTruthy();
    });

    it('calls onBack when back button is pressed', () => {
      const onBack = jest.fn();
      const { getByText } = render(<GameHeader {...defaultProps} onBack={onBack} />);
      
      fireEvent.press(getByText('← Geri'));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('displays correct score', () => {
      const { getByText } = render(<GameHeader {...defaultProps} totalScore={42} />);
      
      expect(getByText('42')).toBeTruthy();
    });

    it('shows warning style when time is low', () => {
      const { getByText } = render(
        <GameHeader {...defaultProps} timeLeft={10} isWarning={true} />
      );
      
      const timeText = getByText('01:00');
      expect(timeText).toBeTruthy();
    });

    it('updates when time changes', () => {
      const { getByText, rerender } = render(<GameHeader {...defaultProps} />);
      
      expect(getByText('01:00')).toBeTruthy();
      
      rerender(<GameHeader {...defaultProps} formatTime="00:30" timeLeft={30} />);
      expect(getByText('00:30')).toBeTruthy();
    });
  });

  describe('LetterPool', () => {
    it('renders all letters', () => {
      const letterPool = ['a', 'b', 'c', 'd', 'e'];
      const { getByText } = render(<LetterPool letterPool={letterPool} />);
      
      letterPool.forEach(letter => {
        expect(getByText(letter.toUpperCase())).toBeTruthy();
      });
    });

    it('renders empty pool', () => {
      const { getByText } = render(<LetterPool letterPool={[]} />);
      
      expect(getByText('Harfler')).toBeTruthy();
    });

    it('handles Turkish characters correctly', () => {
      const letterPool = ['ı', 'ş', 'ğ', 'ü', 'ö', 'ç'];
      const { getByText } = render(<LetterPool letterPool={letterPool} />);
      
      expect(getByText('I')).toBeTruthy();
      expect(getByText('Ş')).toBeTruthy();
      expect(getByText('Ğ')).toBeTruthy();
      expect(getByText('Ü')).toBeTruthy();
      expect(getByText('Ö')).toBeTruthy();
      expect(getByText('Ç')).toBeTruthy();
    });

    it('renders large pool correctly', () => {
      const letterPool = Array.from({ length: 20 }, (_, i) => String.fromCharCode(97 + i));
      const { getByText } = render(<LetterPool letterPool={letterPool} />);
      
      expect(getByText('Harfler')).toBeTruthy();
      expect(getByText('A')).toBeTruthy();
      expect(getByText('T')).toBeTruthy();
    });
  });

  describe('WordInput', () => {
    const defaultProps = {
      currentWord: '',
      onChangeText: jest.fn(),
      onSubmit: jest.fn(),
      disabled: false,
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders correctly', () => {
      const { getByPlaceholderText, getByText } = render(<WordInput {...defaultProps} />);
      
      expect(getByPlaceholderText('Kelimeyi yazın...')).toBeTruthy();
      expect(getByText('Gönder')).toBeTruthy();
    });

    it('updates word when text changes', () => {
      const onChangeText = jest.fn();
      const { getByPlaceholderText } = render(
        <WordInput {...defaultProps} onChangeText={onChangeText} />
      );
      
      const input = getByPlaceholderText('Kelimeyi yazın...');
      fireEvent.changeText(input, 'test');
      
      expect(onChangeText).toHaveBeenCalledWith('test');
    });

    it('calls onSubmit when submit button is pressed', () => {
      const onSubmit = jest.fn();
      const { getByText } = render(
        <WordInput {...defaultProps} currentWord="test" onSubmit={onSubmit} />
      );
      
      fireEvent.press(getByText('Gönder'));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('disables input and button when disabled prop is true', () => {
      const { getByPlaceholderText } = render(
        <WordInput {...defaultProps} disabled={true} />
      );
      
      const input = getByPlaceholderText('Kelimeyi yazın...');
      
      expect(input.props.editable).toBe(false);
    });

    it('does not call onSubmit when disabled', () => {
      const onSubmit = jest.fn();
      const { getByText } = render(
        <WordInput {...defaultProps} disabled={true} onSubmit={onSubmit} />
      );
      
      fireEvent.press(getByText('Gönder'));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('displays current word value', () => {
      const { getByDisplayValue } = render(
        <WordInput {...defaultProps} currentWord="kelime" />
      );
      
      expect(getByDisplayValue('kelime')).toBeTruthy();
    });
  });

  describe('WordsList', () => {
    it('renders correctly with title and count', () => {
      const words = [{ text: 'test', score: 4 }];
      const { getByText } = render(<WordsList words={words} title="Kelimeler" />);
      
      // Title and count are shown together
      expect(getByText(/Kelimeler/)).toBeTruthy();
      expect(getByText(/1/)).toBeTruthy();
    });

    it('renders list of words with scores in uppercase', () => {
      const words = [
        { text: 'kelime', score: 6 },
        { text: 'oyun', score: 4 },
        { text: 'test', score: 5 }
      ];
      const { getByText } = render(<WordsList words={words} title="Kelimelerim" />);
      
      // Words are displayed in uppercase
      expect(getByText('KELIME')).toBeTruthy();
      expect(getByText('+6')).toBeTruthy();
      expect(getByText('OYUN')).toBeTruthy();
      expect(getByText('+4')).toBeTruthy();
      expect(getByText('TEST')).toBeTruthy();
      expect(getByText('+5')).toBeTruthy();
    });

    it('displays title with word count', () => {
      const words = [{ text: 'test', score: 4 }];
      const { getByText } = render(<WordsList words={words} title="Benim Kelimelerim" />);
      
      // Title is shown with count in parentheses
      expect(getByText(/Benim Kelimelerim/)).toBeTruthy();
      expect(getByText(/\(1\)/)).toBeTruthy();
    });

    it('handles single word correctly', () => {
      const words = [{ text: 'single', score: 6 }];
      const { getByText } = render(<WordsList words={words} title="Kelimeler" />);
      
      expect(getByText('SINGLE')).toBeTruthy();
      expect(getByText('+6')).toBeTruthy();
    });

    it('handles many words with different scores', () => {
      const words = Array.from({ length: 10 }, (_, i) => ({
        text: `word${i}`,
        score: i + 1
      }));
      const { getByText } = render(<WordsList words={words} title="Kelimeler" />);
      
      // Check first and last words are rendered in uppercase
      expect(getByText('WORD0')).toBeTruthy();
      expect(getByText('+1')).toBeTruthy();
      expect(getByText('WORD9')).toBeTruthy();
      expect(getByText('+10')).toBeTruthy();
    });

    it('displays high scores correctly with Turkish characters', () => {
      const words = [
        { text: 'uzun', score: 4 },
        { text: 'çokuzun', score: 7 }
      ];
      const { getByText } = render(<WordsList words={words} title="Yüksek Skorlar" />);
      
      // Turkish characters are preserved in uppercase
      expect(getByText('UZUN')).toBeTruthy();
      expect(getByText('+4')).toBeTruthy();
      expect(getByText('ÇOKUZUN')).toBeTruthy();
      expect(getByText('+7')).toBeTruthy();
    });

    it('shows empty list with zero count', () => {
      const { getByText } = render(<WordsList words={[]} title="Kelimeler" />);
      
      expect(getByText(/Kelimeler/)).toBeTruthy();
      expect(getByText(/\(0\)/)).toBeTruthy();
    });
  });
});
