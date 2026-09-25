/**
 * Canale condiviso (senza re-render React) tra il player audio e la scena WebGL:
 * il player scrive il livello RMS a ogni frame, la Hero 3D lo legge in useFrame.
 */
export const audioBus = {
  level: 0,
  playing: false,
};
