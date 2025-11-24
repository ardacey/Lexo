import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast, ToastType } from '../components/Toast';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<{
    visible: boolean;
    message: string;
    type: ToastType;
    duration: number;
    id: number;
  }>({
    visible: false,
    message: '',
    type: 'info',
    duration: 3000,
    id: 0,
  });

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3000) => {
    setState({
      visible: true,
      message,
      type,
      duration,
      id: Date.now(), // Benzersiz ID ile timer'ın sıfırlanmasını garanti altına alıyoruz
    });
  }, []);

  const hideToast = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const value = React.useMemo(() => ({ showToast, hideToast }), [showToast, hideToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast
        key={state.id} // Her yeni toast mesajında bileşeni yeniden oluşturarak animasyon ve timer'ı sıfırlar
        message={state.message}
        type={state.type}
        visible={state.visible}
        onHide={hideToast}
        duration={state.duration}
      />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
