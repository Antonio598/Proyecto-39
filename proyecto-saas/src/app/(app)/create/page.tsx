import Link from "next/link";
import { Sparkles, PenLine } from "lucide-react";

export default function CreatePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Crear contenido</h1>
        <p className="text-muted-foreground text-sm mt-1">Elige cómo quieres crear tu publicación</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/create/ai"
          className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl p-6 hover:opacity-95 transition-opacity group"
        >
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold mb-2">Generar con IA</h3>
          <p className="text-indigo-100 text-sm">
            La IA genera el video, imagen o copy automáticamente a partir de tu descripción.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {["Reels", "Shorts", "Imágenes", "Carruseles", "Stories"].map((f) => (
              <span key={f} className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{f}</span>
            ))}
          </div>
        </Link>

        <Link
          href="/create/manual"
          className="bg-white border-2 rounded-2xl p-6 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
        >
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <PenLine className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="text-xl font-bold mb-2">Crear manualmente</h3>
          <p className="text-muted-foreground text-sm">
            Sube tu propio contenido y redacta el caption, hashtags y detalles de la publicación.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {["Subir archivo", "Redactar caption", "Programar"].map((f) => (
              <span key={f} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{f}</span>
            ))}
          </div>
        </Link>
      </div>
    </div>
  );
}
