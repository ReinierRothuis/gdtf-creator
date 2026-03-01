import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { Upload, FileText, Zap, Download } from "lucide-react";
import type { Route } from "./+types/home";
import { Topbar } from "~/components/topbar";
import { Background } from "~/components/background";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

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
  const [error, setError] = useState<string | null>(null);

  const createSession = useMutation(api.sessions.createSession);
  const generateUploadUrl = useMutation(api.sessions.generateUploadUrl);
  const savePdf = useMutation(api.sessions.savePdf);

  const handleFile = useCallback(
    async (file: File) => {
      if (!isPdf(file)) return;
      setIsProcessing(true);
      setError(null);

      try {
        const sessionId = await createSession();
        const uploadUrl = await generateUploadUrl();

        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload PDF");
        }

        const { storageId } = (await uploadResponse.json()) as {
          storageId: Id<"_storage">;
        };
        await savePdf({ sessionId, storageId });

        navigate(`/session/${sessionId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setIsProcessing(false);
      }
    },
    [navigate, createSession, generateUploadUrl, savePdf],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
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
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className="flex min-h-screen flex-col bg-void"
    >
      <Background opacity={isDragging ? 0.65 : 0.4} />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Topbar />

        {/* Full-screen drag border */}
        {isDragging && (
          <div className="pointer-events-none fixed inset-0 z-50 border-2 border-dashed border-cyan" />
        )}

        <main className="grid flex-1 grid-cols-[1fr_280px]">
          {/* Left — Hero + Upload */}
          <div className="flex flex-col gap-8 p-8">
            {/* Hero text */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-flood">
                PDF to <span className="text-cyan">.gdtf</span> in seconds
              </h1>
              <p className="mt-3 max-w-lg font-sans text-sm text-spot">
                Upload a lighting fixture manual. AI extracts the data. Download
                a valid GDTF file. No manual entry required.
              </p>
            </div>

            {/* Upload zone — expands to fill available height */}
            <div className="flex flex-1 flex-col gap-4">
              <label
                className={`group flex flex-1 cursor-pointer flex-col items-center justify-center gap-4 border border-dashed transition-colors duration-150 ${
                  isProcessing
                    ? "pointer-events-none opacity-40"
                    : "border-haze bg-pit/50 hover:border-cyan hover:bg-cyan-dim/50"
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
                    <p className="text-sm text-cyan">
                      Uploading & creating session...
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-wash transition-colors duration-150 group-hover:text-cyan" />
                    <p className="text-sm text-spot">
                      Drop a <span className="font-bold text-cyan">.pdf</span>{" "}
                      fixture manual here
                    </p>
                    <p className="text-xs text-wash">or click to browse</p>
                  </>
                )}
              </label>

              {error && <p className="text-sm text-error">{error}</p>}
            </div>
          </div>

          {/* Right — Process steps sidebar */}
          <aside className="flex flex-col border-l border-haze bg-pit">
            <div className="px-4 py-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-wash">
                How it works
              </span>
            </div>
            <div className="flex flex-1 flex-col">
              <Step
                number="01"
                icon={<FileText className="h-5 w-5" />}
                label="Upload PDF"
                description="Drop your fixture manual — any manufacturer, any format. The AI handles the rest."
                active
              />
              <Step
                number="02"
                icon={<Zap className="h-5 w-5" />}
                label="AI Extracts"
                description="LLM reads the document, identifies DMX channels, modes, physical properties, and wheel data."
              />
              <Step
                number="03"
                icon={<Download className="h-5 w-5" />}
                label="Download GDTF"
                description="Get a spec-compliant GDTF 1.2 file ready for your lighting console."
              />
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function Step({
  number,
  icon,
  label,
  description,
  active,
}: {
  number: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex flex-1 flex-col gap-3 border-b border-haze px-4 py-5 last:border-b-0 ${
        active ? "bg-deck" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-bold tabular-nums ${active ? "text-cyan" : "text-wash"}`}
        >
          {number}
        </span>
        <div className={active ? "text-cyan" : "text-spot"}>{icon}</div>
        <span
          className={`text-xs font-bold uppercase tracking-widest ${active ? "text-flood" : "text-spot"}`}
        >
          {label}
        </span>
      </div>
      <p className="font-sans text-xs leading-relaxed text-spot">
        {description}
      </p>
    </div>
  );
}
