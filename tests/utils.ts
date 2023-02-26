/* eslint-disable import/prefer-default-export */
export const pause = (seconds: number) => new Promise((r) => { setTimeout(r, seconds * 1000); });
