/** Fußzeile mit Fehler-Hinweis und Link zum Quellcode (Start- und Detailseite) */
export default function Footer() {
  return (
    <div className="shrink-0 border-t border-scholle-border bg-scholle-bg-light px-4 py-2">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-scholle-text-light text-center">
        <span>
          Fehler in der Karte? Bitte melden Sie diese an{" "}
          <a
            href="mailto:scholle-map@tk22.de"
            className="text-scholle-blue hover:text-scholle-blue-dark underline"
          >
            scholle-map@tk22.de
          </a>{" "}
          oder direkt beim Verein.
        </span>
        <a
          href="https://github.com/TimKraemer/Deutsche-Scholle"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-scholle-blue hover:text-scholle-blue-dark"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4" fill="currentColor">
            <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
          </svg>
          Quellcode auf GitHub
        </a>
      </div>
    </div>
  );
}
