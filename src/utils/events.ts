type Listener<T> = (event: T) => void;

export class TypedEmitter<T> {
  private listeners: Set<Listener<T>> = new Set();

  on(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: T): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
