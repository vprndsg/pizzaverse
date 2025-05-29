export const nodes = [
  { id: "merlot",      category: "wine",  layer: 0 },
  { id: "cabernet",    category: "wine",  layer: 0 },
  { id: "pinotnoir",   category: "wine",  layer: 0 },
  { id: "chardonnay",  category: "wine",  layer: 0 },

  { id: "pepperoni",   category: "pizza", layer: 5 },
  { id: "margherita",  category: "pizza", layer: 5 },
  { id: "bbqchicken",  category: "pizza", layer: 5 },
  { id: "mushroom",    category: "pizza", layer: 5 }
];

export const links = [
  { source: "merlot", target: "pepperoni", strength: 0.9 },
  { source: "merlot", target: "margherita", strength: 0.7 },
  { source: "cabernet", target: "pepperoni", strength: 0.8 },
  { source: "cabernet", target: "bbqchicken", strength: 0.6 },
  { source: "pinotnoir", target: "mushroom", strength: 0.75 },
  { source: "chardonnay", target: "margherita", strength: 0.5 }
];
