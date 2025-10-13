import '@testing-library/jest-native/extend-expect';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Clerk
jest.mock('@clerk/clerk-expo', () => ({
  useUser: jest.fn(() => ({ user: null, isLoaded: true })),
  useAuth: jest.fn(() => ({ isLoaded: true, isSignedIn: false })),
  SignedIn: ({ children }) => children,
  SignedOut: ({ children }) => children,
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  Link: 'Link',
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
    Heavy: 'Heavy',
  },
}));

// Mock react-native-toast-message
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
  hide: jest.fn(),
  default: 'Toast',
}));

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1,
}));

// Suppress console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
