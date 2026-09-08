import * as React from "react";
import {
  AtSign,
  BadgeCheck,
  Check,
  ChevronDown,
  IdCard,
  Search,
  UserRound,
  UserRoundX,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  searchDirectory,
  type IdentifierType,
  type RosterUser,
  type UserMatchStatus,
} from "@/lib/objectivesImport";

/**
 * Elegir al usuario de UBITS detrás de un identificador del archivo.
 *
 * El nombre es el control. Un botón aparte de "cambiar usuario" se leía como
 * acción secundaria cuando reasignar es el punto de este paso, así que la
 * identidad hace de combobox que abre el directorio.
 *
 * Un nombre solo no confirma una identidad: dos personas lo comparten, y UBITS
 * acepta tres clases distintas de username. Por eso username, correo, área y
 * líder viajan con el nombre en cada candidato.
 */

const DetailItem: React.FC<{
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  value?: string;
  label: string;
}> = ({ icon: Icon, value, label }) => {
  if (!value) return null;

  return (
    <span className="inline-flex min-w-0 items-center gap-1" title={`${label}: ${value}`}>
      <Icon className="size-3 shrink-0 text-text-muted" strokeWidth={2.25} />
      <span className="truncate">{value}</span>
    </span>
  );
};

/** Los atributos de la persona, para confirmar que el match es quien debe ser. */
export const UserDetails: React.FC<{ user: RosterUser; className?: string }> = ({
  user,
  className,
}) => (
  <span
    className={cn(
      "flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] font-medium text-text-secondary/70",
      className
    )}
  >
    <DetailItem icon={UserRound} value={user.username} label="Username" />
    {user.email !== user.username && <DetailItem icon={AtSign} value={user.email} label="Correo" />}
    <DetailItem icon={IdCard} value={user.documentId} label="Documento" />
    <DetailItem icon={Users} value={user.area} label="Área" />
    <DetailItem icon={BadgeCheck} value={user.leader} label="Líder" />
  </span>
);

const IDENTIFIER_LABEL: Record<IdentifierType, string> = {
  correo: "correo",
  documento: "documento",
  username: "username",
  nombre: "nombre",
  telefono: "teléfono",
};

export interface UserIdentityPickerProps {
  /** Entre quiénes elegir: el ciclo más el directorio de UBITS. */
  candidates: RosterUser[];
  /** Usuario ya asignado, si lo hay. */
  value?: RosterUser;
  /**
   * Candidato que proponemos pero nadie ha confirmado. Se muestra en el campo
   * como un valor real, porque la decisión del revisor es sobre esa persona.
   */
  proposed?: RosterUser;
  onChange: (user: RosterUser | null) => void;
  /** El identificador que escribió el archivo — lo que se está resolviendo. */
  identifier: string;
  identifierType: IdentifierType;
  matchStatus: UserMatchStatus;
}

export const UserIdentityPicker: React.FC<UserIdentityPickerProps> = ({
  candidates,
  value,
  proposed,
  onChange,
  identifier,
  identifierType,
  matchStatus,
}) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const results = React.useMemo(() => searchDirectory(candidates, query, 40), [candidates, query]);

  const closePanel = () => {
    setOpen(false);
    setQuery("");
  };

  const select = (user: RosterUser | null) => {
    onChange(user);
    closePanel();
  };

  const isResolved = matchStatus === "matched" && value !== undefined;
  /** A quién nombra el campo ahora mismo: la propuesta gana sobre el valor. */
  const shownUser = proposed ?? value;
  const isEmpty = matchStatus === "unmatched" && shownUser === undefined;
  const isUnconfirmed = isEmpty || proposed !== undefined;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            isResolved
              ? `Usuario asociado a ${identifier}. Clic para cambiarlo.`
              : `${identifier} no tiene usuario asociado. Clic para elegir uno.`
          }
          className={cn(
            "group/id flex h-8 min-w-0 max-w-full items-center gap-1.5 rounded-lg border pl-2 pr-1.5 text-left transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            isUnconfirmed
              ? "border-primary/50 bg-primary/[0.04] hover:border-primary"
              : "border-border/60 hover:border-border hover:bg-surface-muted/60"
          )}
        >
          <span
            className={cn(
              "truncate text-[12.5px] font-bold",
              isUnconfirmed ? "text-primary" : "text-text-primary"
            )}
          >
            {shownUser?.name ?? (isEmpty ? "Selecciona un usuario" : identifier)}
          </span>
          <ChevronDown
            className="size-3 shrink-0 text-text-muted/70 transition-colors group-hover/id:text-text-secondary"
            strokeWidth={2.5}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[380px] overflow-hidden p-0">
        <div className="border-b border-border/50 px-3 py-2.5">
          <p className="text-[11px] font-medium text-text-secondary">
            El archivo lo identifica por {IDENTIFIER_LABEL[identifierType]} como{" "}
            <span className="break-all font-bold text-text-primary">{identifier}</span>
          </p>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nombre, username, correo o documento"
              aria-label="Buscar usuario de UBITS"
              className="h-8 w-full rounded-lg border border-border/60 bg-surface pl-8 pr-2.5 text-[12px] font-medium text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="max-h-[300px] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-[11px] font-medium text-text-secondary">
                Ningún usuario de UBITS coincide con "{query}".
              </p>
            </div>
          ) : (
            results.map((user) => {
              const isSelected = value?.username === user.username;
              return (
                <button
                  key={user.username}
                  type="button"
                  onClick={() => select(user)}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors",
                    isSelected ? "bg-primary/5" : "hover:bg-surface-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      isSelected ? "text-primary" : "text-transparent"
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-bold text-text-primary">{user.name}</span>
                      {user.onCycle && (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold bg-status-positive/10 text-status-positive">
                          En el ciclo
                        </span>
                      )}
                    </span>
                    <UserDetails user={user} className="mt-0.5" />
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* La única salida que no es "elige a alguien": dejar el grupo sin
            resolver antes que cargarlo contra la persona equivocada. */}
        {value && (
          <div className="flex flex-col border-t border-border/50 p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => select(null)}
              className="w-full justify-start gap-1.5 px-2 text-[11px] font-bold text-text-secondary hover:bg-status-negative/10 hover:text-status-negative"
            >
              <UserRoundX className="size-3.5" strokeWidth={2.25} />
              Dejar sin asociar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
