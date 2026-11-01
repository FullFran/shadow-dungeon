/// <reference lib="webworker" />
import { bakeEffect, type BakedEffect, type BakeRequest } from './bake';
import { loadEffect } from './effects';

/** Bakes effects off the main thread, one at a time, so a first use never drops a frame. */

export type BakeMessage = BakeRequest & { key: string };
export type BakeReply = { key: string; baked: BakedEffect } | { key: string; error: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async (event: MessageEvent<BakeMessage>) => {
  const { key, ...request } = event.data;
  try {
    const baked = bakeEffect(await loadEffect(request.effect), request);
    const reply: BakeReply = { key, baked };
    scope.postMessage(reply, [baked.pixels.buffer]);
  } catch (error) {
    const reply: BakeReply = { key, error: String(error) };
    scope.postMessage(reply);
  }
};
