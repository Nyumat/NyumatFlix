/**
 * EventEmitter - Type-safe event emitter for player events
 */

import { Logger } from '../utils/Logger';

const TAG = 'EventEmitter';

type EventCallback<T> = (data: T) => void;

export class EventEmitter<EventMap extends { [K in keyof EventMap]: unknown }> {
  private listeners: Map<keyof EventMap, Set<EventCallback<unknown>>> = new Map();

  on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  off<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback as EventCallback<unknown>);
    }
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const callback of eventListeners) {
        try {
          callback(data);
        } catch (error) {
          Logger.error(TAG, `Error in event listener for ${String(event)}:`, error);
        }
      }
    }
  }

  once<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): () => void {
    const wrapper = (data: EventMap[K]) => {
      callback(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  removeAllListeners(event?: keyof EventMap): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: keyof EventMap): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
