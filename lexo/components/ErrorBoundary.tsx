import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // Error caught by boundary - no logging in production
  }

  public resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView className="flex-1 bg-white justify-center items-center">
          <View className="p-5 items-center w-full">
            <Text className="text-2xl font-bold mb-2.5 text-gray-800">Bir şeyler yanlış gitti</Text>
            <Text className="text-base text-center mb-5 text-gray-600">
              Uygulamada beklenmedik bir hata oluştu. Lütfen tekrar deneyin.
            </Text>
            {__DEV__ && this.state.error && (
              <Text className="text-xs text-red-500 mb-5 bg-gray-100 p-2.5 rounded w-full">{this.state.error.toString()}</Text>
            )}
            <TouchableOpacity className="bg-blue-500 px-5 py-3 rounded-lg" onPress={this.resetError}>
              <Text className="text-white text-base font-semibold">Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
