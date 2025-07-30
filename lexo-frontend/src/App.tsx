import Game from "./components/Game";
import { Toaster } from 'sonner';

function App() {
  return (
    <main className="bg-slate-100 text-slate-900 min-h-screen flex flex-col items-center justify-center p-4 font-mono">
      <Game />
      <Toaster richColors theme="light" position="bottom-right" />
    </main>
  );
}

export default App;