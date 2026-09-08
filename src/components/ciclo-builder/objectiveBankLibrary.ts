import * as React from "react";
import { AMBITION_FACTOR, type AmbitionLevel } from "./aiObjectiveGenerator";
import { parseAmount, type MeasureType, type ObjectiveDirection } from "./cicloBuilderTypes";
import {
  type ObjectiveBankArea,
  type ObjectiveBankItem,
  type ObjectiveBankTheme,
  type ObjectiveScope,
} from "./objectiveBankTypes";
import { OBJECTIVE_BANK } from "./objectiveBankData";

/**
 * El banco de objetivos, capa "guardado por el autor" — igual que
 * `questionBankLibrary.ts` layera lo que un autor guarda sobre el banco de
 * preguntas. `OBJECTIVE_BANK` es exclusivamente de UBITS y nunca se toca;
 * todo lo que un autor guarda desde una tarjeta del constructor vive en
 * `localStorage`, montado encima al leer.
 *
 * Dos almacenes separados, por la misma razón que allá: un objetivo guardado
 * puede caer en dos sitios distintos —
 * - un tema nuevo entero (creado aquí o antes) bajo un área fija de UBITS;
 * - un objetivo suelto añadido a un tema *existente* de UBITS, que es
 *   estático y por eso se guarda aparte y se fusiona al leer.
 */

interface StoredCustomTheme extends ObjectiveBankTheme {
  areaId: string;
}

interface StoredCustomItem {
  themeId: string;
  item: ObjectiveBankItem;
}

const CUSTOM_THEMES_KEY = "ubits.objectiveBank.library.customThemes.v1";
const CUSTOM_ITEMS_KEY = "ubits.objectiveBank.library.customItems.v1";

const isItem = (value: unknown): value is ObjectiveBankItem => {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<ObjectiveBankItem>;
  return typeof entry.id === "string" && typeof entry.title === "string" && typeof entry.measure === "string";
};

const isCustomTheme = (value: unknown): value is StoredCustomTheme => {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<StoredCustomTheme>;
  return (
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    typeof entry.areaId === "string" &&
    Array.isArray(entry.items) &&
    entry.items.every(isItem)
  );
};

const isCustomItem = (value: unknown): value is StoredCustomItem => {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<StoredCustomItem>;
  return typeof entry.themeId === "string" && isItem(entry.item);
};

function readJson<T>(key: string, isEntry: (value: unknown) => value is T): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function writeJson<T>(key: string, entries: readonly T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    // Storage llena o bloqueada — la sesión sigue funcionando, solo sin guardar.
  }
}

const readCustomThemes = (): StoredCustomTheme[] => readJson(CUSTOM_THEMES_KEY, isCustomTheme);
const writeCustomThemes = (entries: readonly StoredCustomTheme[]): void =>
  writeJson(CUSTOM_THEMES_KEY, entries);

const readCustomItems = (): StoredCustomItem[] => readJson(CUSTOM_ITEMS_KEY, isCustomItem);
const writeCustomItems = (entries: readonly StoredCustomItem[]): void =>
  writeJson(CUSTOM_ITEMS_KEY, entries);

/** Sin acentos, minúscula, con guiones: "Bienestar laboral" → "bienestar-laboral". */
function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function freeItemId(): string {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `obj-custom-${random}`;
}

function freeThemeId(name: string): string {
  const base = `custom-${slug(name) || "tema"}`;
  const taken = new Set([
    ...OBJECTIVE_BANK.flatMap((area) => area.themes.map((theme) => theme.id)),
    ...readCustomThemes().map((theme) => theme.id),
  ]);
  let id = base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

/**
 * El banco entero: las áreas y temas semilla de UBITS con lo que un autor ha
 * guardado ya fusionado — objetivos sueltos dentro de sus temas de UBITS, y
 * temas propios añadidos al final de las áreas a las que pertenecen.
 */
export function getBankAreasWithLibrary(): ObjectiveBankArea[] {
  const customThemes = readCustomThemes();
  const customItems = readCustomItems();

  return OBJECTIVE_BANK.map((area) => {
    const themes = area.themes.map((theme) => {
      const extra = customItems.filter((entry) => entry.themeId === theme.id).map((entry) => entry.item);
      return extra.length === 0 ? theme : { ...theme, items: [...theme.items, ...extra] };
    });

    const ownCustomThemes: ObjectiveBankTheme[] = customThemes
      .filter((theme) => theme.areaId === area.id)
      .map((theme) => ({
        id: theme.id,
        name: theme.name,
        description: theme.description,
        items: theme.items,
        origin: theme.origin,
      }));

    return ownCustomThemes.length === 0 ? { ...area, themes } : { ...area, themes: [...themes, ...ownCustomThemes] };
  });
}

/**
 * Guarda un objetivo en el banco: en un tema existente (uno de UBITS, vía la
 * capa de objetivos sueltos, o uno propio, añadido directo) o en un tema
 * nuevo bajo el área elegida. Devuelve null si no se dio ni un tema destino
 * ni un nombre para uno nuevo, o si el título llega vacío.
 */
export function addObjectiveToBank(input: {
  areaId: string;
  themeId?: string;
  newThemeName?: string;
  /** En qué nivel están las cifras que trae el objetivo — el banco siempre
   *  guarda su referencia en "retador", así que si el autor dice que las
   *  suyas son de otro nivel, aquí se deshace el mismo estiramiento que
   *  `bankItemValues` aplicaría después para volver a esta meta. */
  ambition: AmbitionLevel;
  objective: {
    scope: ObjectiveScope;
    title: string;
    description: string;
    measure: MeasureType;
    direction: ObjectiveDirection | null;
    initialValue: string;
    targetValue: string;
  };
}): ObjectiveBankItem | null {
  const title = input.objective.title.trim();
  if (title === "") return null;

  const isBoolean = input.objective.measure === "boolean";
  const initial = isBoolean ? 0 : (parseAmount(input.objective.initialValue) ?? 0);
  const enteredTarget = isBoolean ? 0 : (parseAmount(input.objective.targetValue) ?? 0);
  // Inversa de `bankItemValues`: stretched = initial + (target - initial) * factor,
  // así que target = initial + (stretched - initial) / factor. Redondeada:
  // el catálogo entero está escrito en cifras enteras, y la división puede
  // dejar centavos que nadie escribió.
  const factor = AMBITION_FACTOR[input.ambition];
  const target = isBoolean ? 0 : Math.round(initial + (enteredTarget - initial) / factor);

  const item: ObjectiveBankItem = {
    id: freeItemId(),
    scope: input.objective.scope,
    title,
    description: input.objective.description.trim(),
    measure: input.objective.measure,
    direction: isBoolean ? null : input.objective.direction,
    initial,
    target,
    origin: "custom",
  };

  if (input.themeId) {
    const customThemes = readCustomThemes();
    const targetCustom = customThemes.find((theme) => theme.id === input.themeId);
    if (targetCustom) {
      writeCustomThemes(
        customThemes.map((theme) =>
          theme.id === input.themeId ? { ...theme, items: [...theme.items, item] } : theme
        )
      );
      notifyLibraryChanged();
      return item;
    }

    const belongsToArea = OBJECTIVE_BANK.find((area) => area.id === input.areaId)?.themes.some(
      (theme) => theme.id === input.themeId
    );
    if (!belongsToArea) return null;

    writeCustomItems([...readCustomItems(), { themeId: input.themeId, item }]);
    notifyLibraryChanged();
    return item;
  }

  const name = (input.newThemeName ?? "").trim();
  if (name === "") return null;

  const newTheme: StoredCustomTheme = {
    id: freeThemeId(name),
    name,
    description: "Guardado desde el constructor de ciclos.",
    origin: "custom",
    areaId: input.areaId,
    items: [item],
  };
  writeCustomThemes([...readCustomThemes(), newTheme]);
  notifyLibraryChanged();
  return item;
}

const libraryListeners = new Set<() => void>();

function notifyLibraryChanged(): void {
  libraryListeners.forEach((listener) => listener());
}

/**
 * Suscribe un componente al banco de objetivos. Vive fuera de React
 * (respaldado en `localStorage`), así que cada guardado tiene que avisar a
 * todos sus consumidores — el drawer de explorar y el de guardar por igual.
 */
export function useObjectiveBankLibrary(): readonly ObjectiveBankArea[] {
  const [areas, setAreas] = React.useState<readonly ObjectiveBankArea[]>(() => getBankAreasWithLibrary());

  React.useEffect(() => {
    const listener = () => setAreas(getBankAreasWithLibrary());
    libraryListeners.add(listener);
    return () => {
      libraryListeners.delete(listener);
    };
  }, []);

  return areas;
}
