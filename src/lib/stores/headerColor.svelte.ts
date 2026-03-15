let headerColor = $state<[number, number, number] | null>(null);

export function setHeaderColor(color: [number, number, number] | null) {
  headerColor = color;
}

export function getHeaderColor() {
  return {
    get color() { return headerColor; },
  };
}
