import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { Upload, FileText, Zap, Download } from "lucide-react";
import type { Route } from "./+types/home";
import { Topbar } from "~/components/topbar";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "GDTF Creator — PDF to GDTF in seconds" },
    {
      name: "description",
      content:
        "Upload a lighting fixture PDF manual and get a valid GDTF file. AI-powered extraction, no manual data entry.",
    },
  ];
}

function isPdf(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return file.name.toLowerCase().endsWith(".pdf");
}

export default function Home() {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!isPdf(file)) return;
      setIsProcessing(true);
      // Simulate session creation — in production this uploads to Convex
      // and returns a session ID
      const sessionId = crypto.randomUUID().slice(0, 8);
      setTimeout(() => {
        navigate(`/session/${sessionId}`);
      }, 800);
    },
    [navigate]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="flex min-h-screen flex-col bg-void">
      <Topbar />

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-flood">
            PDF to{" "}
            <span className="text-cyan">.gdtf</span>{" "}
            in seconds
          </h1>
          <p className="mt-3 max-w-md font-sans text-sm text-spot">
            Upload a lighting fixture manual. AI extracts the data.
            Download a valid GDTF file. No manual entry required.
          </p>
        </div>

        {/* Upload zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          className="w-full max-w-lg"
        >
          <label
            className={`group flex cursor-pointer flex-col items-center gap-4 border border-dashed p-12 transition-colors duration-150 ${
              isProcessing
                ? "pointer-events-none opacity-40"
                : isDragging
                  ? "border-cyan bg-cyan-dim"
                  : "border-haze bg-pit hover:border-cyan hover:bg-cyan-dim"
            }`}
          >
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleInputChange}
              disabled={isProcessing}
              className="sr-only"
            />
            {isProcessing ? (
              <>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-6 w-1 animate-waveform bg-cyan"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <p className="text-sm text-cyan">Creating session...</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-wash transition-colors duration-150 group-hover:text-cyan" />
                <p className="text-sm text-spot">
                  Drop a <span className="font-bold text-cyan">.pdf</span> fixture
                  manual here
                </p>
                <p className="text-xs text-wash">or click to browse</p>
              </>
            )}
          </label>
        </div>

        {/* How it works */}
        <div className="mt-16 grid w-full max-w-2xl grid-cols-3 gap-px bg-haze">
          <Step
            number="01"
            icon={<FileText className="h-5 w-5" />}
            label="Upload PDF"
            description="Drop your fixture manual"
          />
          <Step
            number="02"
            icon={<Zap className="h-5 w-5" />}
            label="AI Extracts"
            description="LLM reads & structures data"
          />
          <Step
            number="03"
            icon={<Download className="h-5 w-5" />}
            label="Download"
            description="Get a valid .gdtf file"
          />
        </div>
      </main>
    </div>
  );
}

function Step({
  number,
  icon,
  label,
  description,
}: {
  number: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 bg-deck p-6 text-center">
      <span className="text-xs font-bold tabular-nums text-wash">{number}</span>
      <div className="text-cyan">{icon}</div>
      <span className="text-xs font-bold uppercase tracking-widest text-flood">
        {label}
      </span>
      <span className="font-sans text-xs text-spot">{description}</span>
    </div>
  );
}
