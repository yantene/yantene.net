const currentYear = new Date().getFullYear();

export function Footer(): React.JSX.Element {
  return (
    <footer className="relative border-t border-border/50 [animation:sky-color-cycle_288s_linear_infinite]">
      <div className="relative bg-white/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-center px-6 py-8 text-halo">
          <p className="text-xs text-muted-foreground">
            &copy; {currentYear} yantene
          </p>
        </div>
      </div>
    </footer>
  );
}
