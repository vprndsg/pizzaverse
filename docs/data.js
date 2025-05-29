export const nodes = [
  { id: "merlot", category: "wine" },
  { id: "cabernet", category: "wine" },
  { id: "pinotnoir", category: "wine" },
  { id: "chardonnay", category: "wine" },
  { id: "pepperoni", category: "pizza" },
  { id: "margherita", category: "pizza" },
  { id: "bbqchicken", category: "pizza" },
  { id: "mushroom", category: "pizza" }
];

export const links = [
  { source: "merlot", target: "pepperoni", strength: 0.9 },
  { source: "merlot", target: "margherita", strength: 0.7 },
  { source: "cabernet", target: "pepperoni", strength: 0.8 },
  { source: "cabernet", target: "bbqchicken", strength: 0.6 },
  { source: "pinotnoir", target: "mushroom", strength: 0.75 },
  { source: "chardonnay", target: "margherita", strength: 0.5 }
];
