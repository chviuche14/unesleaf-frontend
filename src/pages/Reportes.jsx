import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Landmark,
  MapPin,
  RefreshCcw,
  Download,
  Filter,
} from "lucide-react";

// --- ✅ CORRECCIÓN 1: Definir la URL de la API aquí ---
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

function timeAgo(iso) {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "hace unos segundos";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days <= 7) return `hace ${days} día${days > 1 ? "s" : ""}`;
  return d.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}

function headerDate(iso) {
  return new Date(iso).toLocaleDateString("es-ES", { dateStyle: "full" });
}

export default function Reportes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [exporting, setExporting] = useState(false);

  // Filtros UI
  const [tipo, setTipo] = useState("todos"); // todos | ciudad | unesco
  const [from, setFrom] = useState("");     // YYYY-MM-DD
  const [to, setTo] = useState("");

  const fetchHistorial = async () => {
    try {
      setLoading(true);
      setErr("");
      const token = localStorage.getItem("token");

      // --- ✅ CORRECCIÓN 2: Usar la variable API_URL ---
      const res = await fetch(`${API_URL}/registros?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } catch (e) {
      console.error(e);
      setErr("No se pudo cargar el historial. Revisa tu sesión.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorial();
  }, []);

  // Aplica filtros en memoria
  const filtered = useMemo(() => {
    let data = items.slice();
    if (tipo !== "todos") data = data.filter((i) => (i.tipo || "") === tipo);
    if (from) {
      const ts = new Date(from + "T00:00:00").getTime();
      data = data.filter((i) => new Date(i.creado_en).getTime() >= ts);
    }
    if (to) {
      const te = new Date(to + "T23:59:59").getTime();
      data = data.filter((i) => new Date(i.creado_en).getTime() <= te);
    }
    // Ordena desc por fecha
    data.sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
    return data;
  }, [items, tipo, from, to]);

  // Agrupa por día
  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of filtered) {
      const k = headerDate(it.creado_en);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(it);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const rowsForExport = (data) =>
    (data ?? []).map((it) => ({
      ID: it.id,
      Usuario: it.username,
      Texto: it.texto_busqueda ?? "",
      Tipo: it.tipo ?? "",
      Longitud: Number(it.lng ?? 0),
      Latitud: Number(it.lat ?? 0),
      FechaISO: new Date(it.creado_en).toISOString(),
      FechaLocal: new Date(it.creado_en).toLocaleString("es-ES"),
    }));

  const exportCSV = (rows) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
    ].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `historial_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    try {
      setExporting(true);
      const rows = rowsForExport(filtered);
      if (!rows.length) return;
      try {
        const XLSX = await import("xlsx"); // npm i xlsx
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Historial");
        const date = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `historial_${date}.xlsx`);
      } catch (e) {
        console.warn("xlsx no disponible, exportando CSV. Para .xlsx: npm i xlsx");
        exportCSV(rows);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Topbar */}
      <header className="sticky top-0 z-20 h-16 px-4 md:px-6 flex items-center justify-between bg-neutral-900/80 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-2 rounded-lg hover:bg-white/10">
            <ArrowLeft className="h-5 w-5 text-neutral-300" />
          </Link>
          <h1 className="font-extrabold text-xl tracking-wide">Historial de Actividad</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchHistorial}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 hover:bg-emerald-500/30"
            title="Refrescar"
          >
            <RefreshCcw className="h-4 w-4" /> Refrescar
          </button>
          <button
            onClick={exportExcel}
            disabled={exporting || loading || filtered.length === 0}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-neutral-800/60 border border-white/10 hover:bg-neutral-800/80 disabled:opacity-50"
            title="Descargar Excel"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Descargar Excel
          </button>
        </div>
      </header>

      {/* Filtros */}
      <section className="border-b border-white/10 bg-neutral-900/40">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="inline-flex items-center gap-2 text-neutral-300">
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filtrar por tipo y fecha</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="p-2 rounded-lg bg-neutral-800/70 border border-white/10 text-sm focus:ring-2 focus:ring-emerald-400"
            >
              <option value="todos">Todas las actividades</option>
              <option value="ciudad">Ciudad</option>
              <option value="unesco">UNESCO</option>
            </select>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="p-2 rounded-lg bg-neutral-800/70 border border-white/10 text-sm focus:ring-2 focus:ring-emerald-400"
              placeholder="Fecha de inicio"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="p-2 rounded-lg bg-neutral-800/70 border border-white/10 text-sm focus:ring-2 focus:ring-emerald-400"
              placeholder="Fecha de fin"
            />
          </div>
        </div>
      </section>

      {/* Lista agrupada */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        {loading ? (
          <div className="flex items-center gap-2 text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando historial...
          </div>
        ) : err ? (
          <p className="text-red-400">{err}</p>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          grouped.map(([fecha, arr]) => (
            <section key={fecha} className="mb-6">
              <h3 className="text-sm uppercase tracking-wider text-neutral-400 mb-3">
                {fecha}
              </h3>
              <div className="space-y-3">
                {arr.map((it) => (
                  <Row key={it.id} item={it} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

/* ---------- Subcomponentes UI ---------- */

function Row({ item }) {
  const isUnesco = item.tipo === "unesco";
  const Icon = isUnesco ? Landmark : MapPin;
  const color = isUnesco ? "text-yellow-400" : "text-orange-400";
  const chipColor =
    "bg-white/5 border border-white/10 text-neutral-300 px-2 py-0.5 rounded-md text-xs";

  const label =
    item.texto_busqueda ||
    `(${Number(item.lat).toFixed(4)}, ${Number(item.lng).toFixed(4)})`;

  return (
    <div className="flex items-center justify-between rounded-xl bg-neutral-900/60 border border-white/10 px-4 py-3 hover:bg-neutral-900/80 transition">
      <div className="flex items-center gap-4">
        <div className={`h-10 w-10 rounded-full bg-neutral-800/70 grid place-items-center border border-white/10`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div className="leading-tight">
          <div className="text-sm">
            <span className="text-emerald-300 font-medium">{item.username}</span>{" "}
            buscó <span className="text-white">{label}</span>
            {item.tipo ? <span className="ml-2 align-middle {chipColor}">{/* placeholder */}</span> : null}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {item.tipo ? <span className={chipColor}> {item.tipo} </span> : null}
            <span className="text-xs text-neutral-400">{timeAgo(item.creado_en)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-neutral-900/40 p-10 text-center">
      <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-neutral-800/60 grid place-items-center">
        <MapPin className="w-6 h-6 text-neutral-300" />
      </div>
      <h4 className="text-lg font-semibold">Sin actividad para los filtros actuales</h4>
      <p className="text-neutral-400 text-sm mt-1">
        Ajusta el tipo o el rango de fechas y vuelve a intentarlo.
      </p>
    </div>
  );
}
