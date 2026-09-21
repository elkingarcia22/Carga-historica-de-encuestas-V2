/**
 * El gesto de abrir el Agente IA, en un solo sitio.
 *
 * Abrir el panel mueve tres cosas a la vez: el panel entra por la derecha, el
 * cajón de objetivos se corre para dejarle sitio y el velo se recorta hasta
 * donde ese sitio empieza. Si cada una lleva su propia duración o su propia
 * curva se leen como tres animaciones sueltas —una empuja, otra se arrastra y
 * otra salta— en vez de como una sola cosa abriéndose.
 *
 * Y llevaban: el cajón heredaba los 500 ms de la animación de entrada del
 * propio `Sheet`, el panel corría a 300 ms y el velo cambiaba de golpe porque
 * nunca tuvo transición. Las curvas a medida tampoco se aplicaban: la clase
 * `duration-500` del `Sheet` viene con la variante `data-[state=open]`, que
 * pesa más que una clase suelta, así que ganaba siempre. Por eso esto se pasa
 * como estilo en línea y no como clases: es la única forma de que el número
 * que se lee aquí sea el que de verdad corre.
 */

import type * as React from "react";

/**
 * Lo que mide el panel abierto. El cajón se corre exactamente esto.
 *
 * No son 400 px a secas: en una ventana angosta —el panel del navegador de
 * Claude, media pantalla— reservarlos dejaba el cajón en 100 px y el chat
 * parecía montado encima del contenido en vez de al lado. Con el tope en
 * proporción, el panel cede cuando no hay sitio y los dos siguen cabiendo.
 * De 890 px de ventana en adelante son los 400 de siempre.
 */
export const AGENT_PANEL_WIDTH = "min(400px, 45vw)";

/**
 * El aire que queda a la izquierda del cajón cuando el panel está abierto,
 * para que se siga viendo que detrás está la app y no una pantalla partida.
 */
export const AGENT_PANEL_GUTTER = 32;

/**
 * Lo que el cajón tiene que descontar además del panel para quedar *junto* a
 * él y no encima.
 *
 * La concha lleva `p-2` alrededor y `gap-2` entre columnas, así que el panel
 * no empieza en el borde de la pantalla: empieza 8 px antes. Un cajón `fixed`
 * vive por encima de ese marco y no lo sabe, así que correrlo solo el ancho
 * del panel lo mete 8 px por debajo de su borde izquierdo —que es justo lo
 * que se ve como "el chat montado sobre el contenido"—. Son los dos ochos:
 * el del padding y el del gap.
 */
export const AGENT_PANEL_SHELL_FRAME = 16;

export const AGENT_PANEL_DURATION_MS = 320;
export const AGENT_PANEL_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

/** `transition` para las propiedades que se muevan con el panel. */
export const agentPanelTransition = (...properties: string[]): string =>
  properties
    .map((property) => `${property} ${AGENT_PANEL_DURATION_MS}ms ${AGENT_PANEL_EASING}`)
    .join(", ");

/**
 * Cómo se corre un cajón —y su velo— para dejarle sitio al panel.
 *
 * El velo no lleva el ancho máximo: con `left: 0` y un `right` puesto, un
 * `max-width` lo encogería desde la izquierda y dejaría sin tapar la franja
 * que el cajón sí cubre.
 */
export function agentPanelShift(open: boolean): {
  content: React.CSSProperties;
  overlay: React.CSSProperties;
} {
  const right = open
    ? `calc(${AGENT_PANEL_WIDTH} + ${AGENT_PANEL_SHELL_FRAME}px)`
    : 0;
  return {
    content: {
      right,
      // Cerrado vuelve a su ancho de siempre, dicho aquí y no en una clase:
      // dejarlo sin poner lo devolvía al `max-w` del tamaño del cajón —más
      // estrecho— en cuanto se cerraba el panel.
      maxWidth: open
        ? `calc(100vw - ${AGENT_PANEL_WIDTH} - ${AGENT_PANEL_SHELL_FRAME + AGENT_PANEL_GUTTER}px)`
        : "min(1280px, 96vw)",
      transition: agentPanelTransition("right", "max-width"),
    },
    overlay: { right, transition: agentPanelTransition("right") },
  };
}
