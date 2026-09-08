import * as React from "react";
import { toast } from "sonner";
import {
  cicloReportTypeFor,
  type CicloDownloadEntry,
  type CicloReportRequest,
} from "./cicloDownloadTypes";
import {
  CSV_MIME,
  buildDetailCsv,
  buildProgressCsv,
  buildUsersCsv,
  fileStamp,
  saveBlob,
  slugify,
} from "./cicloReportCsv";
import { openCicloLetterReport } from "./cicloLetterReport";
import type { CicloReportSource } from "./cicloReportModel";

export interface CicloDownloadCenter {
  entries: readonly CicloDownloadEntry[];
  /** Cierto mientras al menos un reporte sigue preparándose. */
  isBusy: boolean;
  /** Encola un reporte y arranca su preparación (simulada). */
  start: (request: CicloReportRequest) => void;
  /**
   * Vuelve a entregar un archivo listo. La entrega ya ocurrió sola al terminar
   * la preparación, así que esto solo sirve al camino de reintento.
   */
  deliver: (id: string) => void;
  /** Copia un enlace al reporte y se lo dice a quien lo pidió. */
  share: (id: string) => void;
}

/**
 * El estado del centro de descargas, de la pantalla y no del drawer: cerrar el
 * drawer no puede matar un reporte a medio preparar, y el widget flotante
 * necesita la misma lista que muestra la pestaña "Descargas".
 *
 * La preparación se simula con un progreso que avanza —el prototipo no tiene
 * backend— pero la entrega es real: en el momento en que un reporte termina, le
 * pasa al navegador un archivo de verdad armado con el mismo agregado que pinta
 * la pantalla. Sin segundo clic: pedir un reporte *es* pedir la descarga, así
 * que la fila que queda atrás es un recibo, no una acción pendiente.
 */
export function useCicloDownloadCenter(source: CicloReportSource): CicloDownloadCenter {
  const [entries, setEntries] = React.useState<readonly CicloDownloadEntry[]>([]);
  const timersRef = React.useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // La fuente cambia en cada reporte que se guarda —el estado del ciclo vive
  // en la pantalla— y `start` no debe re-crearse por eso: un timer en vuelo
  // seguiría apuntando a la versión vieja. La ref siempre tiene la última.
  const sourceRef = React.useRef(source);
  React.useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  React.useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearInterval(timer));
      timers.clear();
    };
  }, []);

  const start = React.useCallback((request: CicloReportRequest) => {
    const type = cicloReportTypeFor(request.kind);
    const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const extension = type.format === "PDF" ? "pdf" : "csv";
    const fileName = `${type.fileSlug}-${slugify(sourceRef.current.data.name)}-${fileStamp()}.${extension}`;

    const deliver = (): boolean => {
      const current = sourceRef.current;
      switch (request.kind) {
        // La vista de impresión es un iframe y una entrega automática no tiene
        // un clic detrás: un navegador que la bloquee es un resultado normal
        // aquí, no un bug, así que viaja de vuelta como `false` y la fila
        // ofrece "Reintentar".
        case "individual":
          return openCicloLetterReport(current, request);
        case "detalle":
          saveBlob(fileName, CSV_MIME, buildDetailCsv(current, request));
          return true;
        case "progreso":
          saveBlob(fileName, CSV_MIME, buildProgressCsv(current, request));
          return true;
        case "usuarios":
          saveBlob(fileName, CSV_MIME, buildUsersCsv(current, request));
          return true;
      }
    };

    const entry: CicloDownloadEntry = {
      id,
      kind: request.kind,
      fileName,
      format: type.format,
      status: "preparing",
      progress: 0,
      startedAt: Date.now(),
      delivered: false,
      deliver,
      request,
    };
    setEntries((current) => [entry, ...current]);

    // Pasos desiguales a propósito: un progreso perfectamente lineal se lee
    // como falso.
    //
    // El azar y la entrega viven en el cuerpo del intervalo, nunca dentro del
    // updater de estado: React corre los updaters dos veces en StrictMode, y
    // un segundo tiro de dados volvería a entregar el archivo y desharía la
    // finalización que alcanzó el primero.
    const tickMs = 220;
    const meanStep = (100 * tickMs) / type.prepareMs;
    let progress = 0;
    const timer = setInterval(() => {
      progress = Math.min(100, progress + meanStep * (0.4 + Math.random() * 1.2));
      const done = progress >= 100;

      if (!done) {
        setEntries((current) =>
          current.map((candidate) => (candidate.id === id ? { ...candidate, progress } : candidate))
        );
        return;
      }

      const stored = timersRef.current.get(id);
      if (stored) clearInterval(stored);
      timersRef.current.delete(id);

      const delivered = deliver();
      if (delivered) {
        toast.success(`${type.format} descargado`, { description: fileName });
      } else {
        toast.error("No se pudo abrir la vista de impresión", {
          description: "Reintenta la descarga desde la lista de descargas.",
        });
      }
      setEntries((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? { ...candidate, progress: 100, status: "ready" as const, delivered }
            : candidate
        )
      );
    }, tickMs);
    timersRef.current.set(id, timer);
  }, []);

  const deliver = React.useCallback(
    (id: string) => {
      const entry = entries.find((candidate) => candidate.id === id);
      if (entry?.status !== "ready") return;
      const delivered = entry.deliver();
      setEntries((current) =>
        current.map((candidate) => (candidate.id === id ? { ...candidate, delivered } : candidate))
      );
      if (!delivered) {
        toast.error("No se pudo abrir la vista de impresión", {
          description: "Revisa si el navegador está bloqueando las ventanas emergentes.",
        });
      }
    },
    [entries]
  );

  const share = React.useCallback(
    (id: string) => {
      const entry = entries.find((candidate) => candidate.id === id);
      if (!entry || entry.status !== "ready") return;
      // Sin backend que aloje el archivo, compartir es el enlace a esta vista
      // más el nombre del reporte — suficiente para que un colega lo encuentre.
      const link = `${window.location.href.split("#")[0]}#reporte=${encodeURIComponent(entry.fileName)}`;
      copyToClipboard(link).then((copied) => {
        if (copied) {
          toast.success("Enlace copiado", {
            description: "Compártelo con quien deba ver este reporte.",
          });
        } else {
          toast.error("No se pudo copiar el enlace", {
            description: "Copia la URL desde la barra del navegador.",
          });
        }
      });
    },
    [entries]
  );

  const isBusy = entries.some((entry) => entry.status === "preparing");

  return { entries, isBusy, start, deliver, share };
}

/**
 * La Clipboard API asíncrona necesita un permiso que los navegadores
 * embebidos y viejos no siempre dan, así que una escritura denegada cae al
 * truco de la selección en vez de decirle a nadie que compartir está roto.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      return copied;
    } catch {
      return false;
    }
  }
}
