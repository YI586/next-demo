export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground">
          Welcome to Next Demo
        </h1>
        <p className="mb-8 text-lg text-muted-foreground">
          A minimal diagramming application for creating, editing, saving, and loading diagrams composed of sticky notes connected by lines.
        </p>
        <div className="rounded-lg border bg-card p-6 text-card-foreground">
          <h2 className="mb-4 text-xl font-semibold">Features</h2>
          <ul className="space-y-2 text-left">
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span>
              Create and edit sticky notes
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span>
              Connect elements with lines
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span>
              Save and load diagrams
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">✓</span>
              Pan and zoom canvas
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}