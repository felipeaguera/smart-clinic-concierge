import { ChatInterface } from "@/components/chat/ChatInterface";

export default function Atendimento() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex flex-col">
      {/* Header */}
      <header className="bg-background border-b px-4 py-4 shadow-sm">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold text-primary">Clínica Médica</h1>
          <p className="text-sm text-muted-foreground">Atendimento Virtual</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-4 max-w-3xl">
        <ChatInterface className="h-[calc(100vh-140px)]" />
      </main>
    </div>
  );
}
