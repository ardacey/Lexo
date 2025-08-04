import Game from "./components/Game";
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { UserProfile } from './components/UserProfile';

function App() {
  return (
    <AuthProvider>
      <main className="bg-gradient-to-br from-slate-50 to-slate-200 text-slate-900 min-h-screen flex flex-col items-center justify-center p-4 font-mono">
        <div className="absolute top-4 right-4 z-10">
          <UserProfile />
        </div>
        <div className="w-full flex justify-center items-center flex-1">
          <Game />
        </div>
        <Toaster 
          richColors 
          theme="light" 
          position="bottom-right"
          closeButton
          duration={4000}
          toastOptions={{
            style: {
              background: 'white',
              border: '1px solid #e2e8f0',
              color: '#0f172a',
            },
          }}
        />
      </main>
    </AuthProvider>
  );
}

export default App;