import Link from "next/link";
import { Sparkles, Zap, Calendar, BarChart2, CheckSquare, Link2 } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl">ContentAI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground px-4 py-2">
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Empezar gratis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-4 pt-16 pb-20 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-sm font-medium px-4 py-1.5 rounded-full border border-indigo-200 mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          Automatización de contenido con IA
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
          Publica en todas tus{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
            redes sociales
          </span>{" "}
          con IA
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Genera Reels, Shorts, carruseles, imágenes y copies automáticamente.
          Conecta Instagram, Facebook y YouTube. Programa y publica sin intervención manual.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/register"
            className="bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            Comenzar gratis →
          </Link>
          <Link
            href="/login"
            className="border border-gray-200 px-8 py-3.5 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-colors"
          >
            Ver demo
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 pb-24 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Sparkles,
              color: "bg-indigo-50 text-indigo-600",
              title: "Generación con IA",
              desc: "Reels, Shorts, imágenes, carruseles, stories y copies generados con Nano Banana y Kling AI.",
            },
            {
              icon: Link2,
              color: "bg-pink-50 text-pink-600",
              title: "Multi-plataforma",
              desc: "Conecta múltiples cuentas de Instagram, Facebook Pages y canales de YouTube.",
            },
            {
              icon: Calendar,
              color: "bg-blue-50 text-blue-600",
              title: "Calendario visual",
              desc: "Programa y reorganiza publicaciones con drag & drop en una vista mensual y semanal.",
            },
            {
              icon: Zap,
              color: "bg-orange-50 text-orange-600",
              title: "Automatización total",
              desc: "Define reglas por cuenta: frecuencia, horarios, formatos y modo de publicación.",
            },
            {
              icon: CheckSquare,
              color: "bg-green-50 text-green-600",
              title: "Flujo de aprobación",
              desc: "Revisa el contenido generado antes de publicarlo. Modo auto o con aprobación.",
            },
            {
              icon: BarChart2,
              color: "bg-purple-50 text-purple-600",
              title: "Multi-workspace",
              desc: "Gestiona múltiples marcas o clientes desde un solo lugar con roles y permisos.",
            },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl border p-6 hover:shadow-md transition-shadow">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color} mb-4`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center py-20 px-4">
        <h2 className="text-4xl font-extrabold mb-4">Empieza hoy, gratis</h2>
        <p className="text-indigo-100 text-lg mb-8 max-w-xl mx-auto">
          Conecta tus cuentas, configura tu IA y empieza a publicar en minutos.
        </p>
        <Link
          href="/register"
          className="bg-white text-indigo-600 font-bold px-8 py-3.5 rounded-xl text-lg hover:bg-indigo-50 transition-colors inline-block"
        >
          Crear cuenta gratis →
        </Link>
      </section>

      <footer className="text-center py-8 text-sm text-muted-foreground border-t">
        © 2024 ContentAI · Automatización de contenido con IA
      </footer>
    </div>
  );
}
