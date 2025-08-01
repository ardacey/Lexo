import Game from "./components/Game";
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { UserProfile } from './components/UserProfile';

function App() {
  return (
    <AuthProvider>
      <main className="bg-slate-100 text-slate-900 min-h-screen flex flex-col items-center justify-center p-4 font-mono">
        <div className="absolute top-4 right-4">
          <UserProfile />
        </div>
        <Game />
        <Toaster richColors theme="light" position="bottom-right" />
      </main>
    </AuthProvider>
  );
}

export default App;